/**
 * Cliente BLE real sobre `react-native-ble-plx` (central GATT).
 *
 * Sólo corre en un development build o en TestFlight: el módulo nativo no está en Expo Go ni en
 * web. Por eso `crearBleClientPlx()` devuelve `null` en vez de lanzar cuando no puede construir el
 * `BleManager`, y `bleClient.ts` cae al stub.
 *
 * Toda la lógica que se puede testear sin radio (parsear chunks, reensamblar, medir, base64) vive
 * en `transferencia.ts`; este archivo sólo mueve bytes entre ble-plx y ese módulo.
 */
import { Platform } from 'react-native';
import { BleError, BleManager, State, type Device, type Subscription } from 'react-native-ble-plx';

import { DEVICE_ADVERTISED_NAME, GATT, type EstadoDispositivo } from '@/features/device/gatt';
import type { DeviceInfo } from '@/features/device/types';
import type { RecognitionEvent } from '@/features/recognition/types';

import { BleDeviceNotFoundError, BleNotConnectedError, type BleClient } from './bleClient';
import {
  BleTransferError,
  Ensamblador,
  codificarTextoBase64,
  decodificarBase64,
  decodificarTextoBase64,
  type MedicionTransferencia,
} from './transferencia';

const SCAN_TIMEOUT_MS = 15_000;
const TRANSFER_TIMEOUT_MS = 60_000;
/**
 * Android negocia el MTU que se le pida hasta 517; iOS ignora el pedido y da 185. Con más MTU van
 * más bytes por notificación y menos notificaciones por foto: es la variable más barata de la
 * medición, y por eso se pide el máximo.
 */
const MTU_PEDIDO = 517;

/** Lo que la placa notifica por `evento`. Espejo de `hardware/raspi/virovision/gatt.py`. */
type Evento =
  | { t: 'inicio'; id: number; tipo: 'medicion' | 'foto'; bytes: number; chunks: number; chunk: number }
  | { t: 'fin'; id: number; bytes: number; chunks: number; ms_placa: number }
  | { t: 'modo'; valor: number }
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

function describirErrorBle(err: unknown): string {
  if (err instanceof BleError) return `${err.message} (código ${err.errorCode}${err.reason ? `, ${err.reason}` : ''})`;
  return err instanceof Error ? err.message : String(err);
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
  private ensamblador: Ensamblador | null = null;
  private alTerminarTransferencia: ((fin: Extract<Evento, { t: 'fin' }>) => void) | null = null;
  private alFallarTransferencia: ((error: Error) => void) | null = null;

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
      this.manager.monitorCharacteristicForDevice(device.id, GATT.serviceUuid, GATT.characteristics.transferencia, (error, c) => {
        if (error) {
          this.alFallarTransferencia?.(new BleTransferError(error.message));
          return;
        }
        if (c?.value) this.recibirChunk(c.value);
      })
    );

    const estado = await this.leerEstado(device);
    return {
      id: device.id,
      name: device.name ?? device.localName ?? DEVICE_ADVERTISED_NAME,
      batteryLevel: estado?.bateria ?? null,
      firmwareVersion: estado?.version ?? null,
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

  async medirTransferencia(bytes: number): Promise<MedicionTransferencia> {
    const device = this.device;
    if (!device) throw new BleNotConnectedError();
    // El callback de desconexión de iOS puede llegar tarde o no llegar: se le pregunta al stack
    // antes de escribir, y si el enlace murió se reporta como tal y no como «no se pudo medir».
    if (!(await this.manager.isDeviceConnected(device.id).catch(() => false))) {
      this.limpiar();
      throw new BleNotConnectedError();
    }
    if (this.ensamblador) throw new BleTransferError('ya hay una transferencia en curso');

    const ensamblador = new Ensamblador();
    this.ensamblador = ensamblador;
    // ATT MTU − 3 bytes de cabecera = payload máximo de una notificación. La placa lo respeta y lo
    // usa como tamaño de chunk; si se lo manda más grande, BlueZ truncaría sin avisar.
    const chunk = Math.max(20, device.mtu - 3);
    const comando = JSON.stringify({ cmd: 'medir', bytes, chunk });

    try {
      const fin = esperar<Extract<Evento, { t: 'fin' }>>(
        TRANSFER_TIMEOUT_MS,
        () => new BleTransferError('la placa no terminó a tiempo', ensamblador.faltantes()),
        (resolver, rechazar) => {
          this.alTerminarTransferencia = resolver;
          this.alFallarTransferencia = rechazar;
          return () => {
            this.alTerminarTransferencia = null;
            this.alFallarTransferencia = null;
          };
        }
      );
      try {
        await this.manager.writeCharacteristicWithResponseForDevice(
          device.id,
          GATT.serviceUuid,
          GATT.characteristics.control,
          codificarTextoBase64(comando)
        );
      } catch (err) {
        // El error de ble-plx trae el motivo real (código y razón del stack): se conserva porque
        // es lo único que permite diagnosticar a distancia, y la UI lo lee del mensaje.
        throw new BleTransferError(`escritura rechazada: ${describirErrorBle(err)}`);
      }
      await fin;
      if (!ensamblador.completo) {
        throw new BleTransferError('la placa terminó pero faltan chunks', ensamblador.faltantes());
      }
      return ensamblador.medicion();
    } finally {
      this.ensamblador = null;
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
      case 'fin':
        this.alTerminarTransferencia?.(evento);
        break;
      case 'error':
        this.alFallarTransferencia?.(new BleTransferError(evento.msg));
        break;
      case 'resultado':
        for (const oyente of this.oyentesReconocimiento) oyente(evento.evento);
        break;
      default:
        break;
    }
  }

  private recibirChunk(base64: string): void {
    const ensamblador = this.ensamblador;
    if (!ensamblador) return;
    try {
      ensamblador.recibir(decodificarBase64(base64));
    } catch (err) {
      this.alFallarTransferencia?.(err instanceof Error ? err : new BleTransferError(String(err)));
    }
  }

  private limpiar(): void {
    for (const s of this.suscripciones) s.remove();
    this.suscripciones = [];
    this.device = null;
    this.alFallarTransferencia?.(new BleNotConnectedError());
    this.ensamblador = null;
  }
}
