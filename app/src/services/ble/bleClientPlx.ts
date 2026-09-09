/**
 * Cliente BLE real sobre `react-native-ble-plx` (central GATT).
 *
 * Sólo corre en un development build o en TestFlight: el módulo nativo no está en Expo Go ni en
 * web. Por eso `crearBleClientPlx()` devuelve `null` en vez de lanzar cuando no puede construir el
 * `BleManager`, y `bleClient.ts` cae al stub.
 *
 * La única lógica testeable sin radio que queda es el base64 de las características, en
 * `base64.ts`; este archivo sólo mueve bytes entre ble-plx y ese módulo.
 */
import { Platform } from 'react-native';
import { BleManager, State, type Device, type Subscription } from 'react-native-ble-plx';

import { DEVICE_ADVERTISED_NAME, GATT, type CredencialesWifi, type EstadoDispositivo } from '@/features/device/gatt';
import type { DeviceInfo } from '@/features/device/types';
import type { RecognitionEvent } from '@/features/recognition/types';

import {
  codificarBase64,
  decodificarBase64,
  decodificarTextoBase64,
} from './base64';
import { BleDeviceNotFoundError, BleNotConnectedError, type BleClient } from './bleClient';

const SCAN_TIMEOUT_MS = 15_000;
/**
 * Android negocia el MTU que se le pida hasta 517; iOS ignora el pedido y da 185. Un MTU grande no
 * mueve la foto —eso va por HTTP (ADR 0003)— pero sí evita que el JSON de `estado` o las
 * credenciales del WiFi lleguen truncados, así que se pide el máximo igual.
 */
const MTU_PEDIDO = 517;

/** Lo que la placa notifica por `evento`. Espejo de `hardware/raspi/virovision/gatt.py`. */
type Evento =
  | { t: 'modo'; valor: number }
  | { t: 'ap'; encendido: boolean; minutos: number }
  | { t: 'error'; msg: string }
  | { t: 'resultado'; evento: RecognitionEvent };

function esperar<T>(ms: number, error: () => Error, ejecutar: (resolver: (v: T) => void, rechazar: (e: Error) => void) => void | (() => void)): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let limpiar: void | (() => void);
    const timer = setTimeout(() => {
      limpiar?.();
      reject(error());
    }, ms);
    limpiar = ejecutar(
      (v) => {
        clearTimeout(timer);
        limpiar?.();
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        limpiar?.();
        reject(e);
      }
    );
  });
}

export function crearBleClientPlx(): BleClient | null {
  if (Platform.OS === 'web') return null;
  let manager: BleManager;
  try {
    manager = new BleManager();
  } catch {
    return null;
  }
  return new BleClientPlx(manager);
}

class BleClientPlx implements BleClient {
  private device: Device | null = null;
  private suscripciones: Subscription[] = [];
  private readonly oyentesReconocimiento = new Set<(event: RecognitionEvent) => void>();
  private readonly oyentesDesconexion = new Set<() => void>();
  private readonly oyentesEstado = new Set<(estado: EstadoDispositivo) => void>();
  private readonly oyentesModo = new Set<(modo: number) => void>();
  private readonly oyentesAp = new Set<(encendido: boolean) => void>();
  private readonly oyentesError = new Set<(mensaje: string) => void>();

  constructor(private readonly manager: BleManager) {}

  async connect(): Promise<DeviceInfo> {
    await this.esperarRadioEncendida();
    const encontrado = await this.escanear();
    // iOS ignora `requestMTU`; Android lo negocia acá mismo y evita una segunda ida y vuelta.
    const conectado = await this.manager.connectToDevice(encontrado.id, { requestMTU: MTU_PEDIDO });
    const device = await conectado.discoverAllServicesAndCharacteristics();
    this.device = device;

    this.suscripciones.push(
      this.manager.onDeviceDisconnected(device.id, () => {
        this.limpiar();
        for (const oyente of this.oyentesDesconexion) oyente();
      }),
      this.manager.monitorCharacteristicForDevice(device.id, GATT.serviceUuid, GATT.characteristics.evento, (error, c) => {
        if (error || !c?.value) return;
        this.recibirEvento(c.value);
      }),
      this.manager.monitorCharacteristicForDevice(device.id, GATT.serviceUuid, GATT.characteristics.estado, (error, c) => {
        if (error || !c?.value) return;
        try {
          const estado = JSON.parse(decodificarTextoBase64(c.value)) as EstadoDispositivo;
          for (const oyente of this.oyentesEstado) oyente(estado);
        } catch {
          /* un estado ilegible no tumba nada */
        }
      }),
      this.manager.monitorCharacteristicForDevice(device.id, GATT.serviceUuid, GATT.characteristics.modo, (error, c) => {
        if (error || !c?.value) return;
        const bytes = decodificarBase64(c.value);
        if (bytes.length > 0) for (const oyente of this.oyentesModo) oyente(bytes[0]);
      })
    );

    const estado = await this.leerEstado(device);
    return {
      id: device.id,
      name: device.name ?? device.localName ?? DEVICE_ADVERTISED_NAME,
      batteryLevel: estado?.bateria ?? null,
      firmwareVersion: estado?.version ?? null,
      direccion: estado?.ip && estado.puerto ? { ip: estado.ip, puerto: estado.puerto } : null,
      ap: estado?.ap ?? false,
    };
  }

  async disconnect(): Promise<void> {
    const id = this.device?.id;
    this.limpiar();
    if (id) await this.manager.cancelDeviceConnection(id).catch(() => {});
  }

  onRecognition(listener: (event: RecognitionEvent) => void): () => void {
    this.oyentesReconocimiento.add(listener);
    return () => this.oyentesReconocimiento.delete(listener);
  }

  onDisconnect(listener: () => void): () => void {
    this.oyentesDesconexion.add(listener);
    return () => this.oyentesDesconexion.delete(listener);
  }

  onEstado(listener: (estado: EstadoDispositivo) => void): () => void {
    this.oyentesEstado.add(listener);
    return () => this.oyentesEstado.delete(listener);
  }

  onModo(listener: (modo: number) => void): () => void {
    this.oyentesModo.add(listener);
    return () => this.oyentesModo.delete(listener);
  }

  onAp(listener: (encendido: boolean) => void): () => void {
    this.oyentesAp.add(listener);
    return () => this.oyentesAp.delete(listener);
  }

  onErrorDispositivo(listener: (mensaje: string) => void): () => void {
    this.oyentesError.add(listener);
    return () => this.oyentesError.delete(listener);
  }

  async escribirModo(modo: number): Promise<void> {
    const device = this.device;
    if (!device) throw new BleNotConnectedError();
    await this.manager.writeCharacteristicWithResponseForDevice(
      device.id,
      GATT.serviceUuid,
      GATT.characteristics.modo,
      codificarBase64(new Uint8Array([modo]))
    );
  }

  async leerWifi(): Promise<CredencialesWifi | null> {
    const device = this.device;
    if (!device) throw new BleNotConnectedError();
    try {
      const c = await this.manager.readCharacteristicForDevice(device.id, GATT.serviceUuid, GATT.characteristics.wifi);
      if (!c.value) return null;
      const datos = JSON.parse(decodificarTextoBase64(c.value)) as Partial<CredencialesWifi>;
      return datos.ssid && datos.clave && datos.ip ? { ssid: datos.ssid, clave: datos.clave, ip: datos.ip, puerto: datos.puerto ?? null } : null;
    } catch {
      // Un firmware viejo sin la característica: la placa no ofrece AP y el modo «misma red» sigue sirviendo.
      return null;
    }
  }

  // --- privados ---------------------------------------------------------------------------------

  private async esperarRadioEncendida(): Promise<void> {
    if ((await this.manager.state()) === State.PoweredOn) return;
    await esperar<void>(
      SCAN_TIMEOUT_MS,
      () => new BleDeviceNotFoundError(),
      (resolver) => {
        const sub = this.manager.onStateChange((s) => {
          if (s === State.PoweredOn) resolver();
        }, true);
        return () => sub.remove();
      }
    );
  }

  private escanear(): Promise<Device> {
    // Se filtra por el UUID del servicio y no por el nombre: es lo único que iOS respeta también con
    // la app en segundo plano, y el nombre puede no venir en el paquete de anuncio.
    return esperar<Device>(
      SCAN_TIMEOUT_MS,
      () => new BleDeviceNotFoundError(),
      (resolver, rechazar) => {
        this.manager.startDeviceScan([GATT.serviceUuid], { allowDuplicates: false }, (error, device) => {
          if (error) {
            rechazar(new BleDeviceNotFoundError());
            return;
          }
          if (device) resolver(device);
        });
        return () => {
          this.manager.stopDeviceScan().catch(() => {});
        };
      }
    );
  }

  private async leerEstado(device: Device): Promise<EstadoDispositivo | null> {
    try {
      const c = await this.manager.readCharacteristicForDevice(device.id, GATT.serviceUuid, GATT.characteristics.estado);
      return c.value ? (JSON.parse(decodificarTextoBase64(c.value)) as EstadoDispositivo) : null;
    } catch {
      // Sin estado igual hay conexión: la pantalla muestra "sin informar", no un error.
      return null;
    }
  }

  private recibirEvento(base64: string): void {
    let evento: Evento;
    try {
      evento = JSON.parse(decodificarTextoBase64(base64)) as Evento;
    } catch {
      return;
    }
    switch (evento.t) {
      case 'error':
        for (const oyente of this.oyentesError) oyente(evento.msg);
        break;
      case 'ap':
        for (const oyente of this.oyentesAp) oyente(evento.encendido);
        break;
      case 'resultado':
        for (const oyente of this.oyentesReconocimiento) oyente(evento.evento);
        break;
      default:
        break;
    }
  }

  private limpiar(): void {
    for (const s of this.suscripciones) s.remove();
    this.suscripciones = [];
    this.device = null;
  }
}
