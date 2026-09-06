/**
 * El dispositivo, compartido por toda la app: conexión BLE, red WiFi de la placa y modo.
 *
 * Es un Provider y no un hook por pantalla por la misma razón que `ModeloSupermercadoProvider`:
 * Dispositivo muestra el estado, Inicio lee con la cámara de la placa, y los dos tienen que ver
 * LA MISMA conexión. Y porque la conexión tiene que existir aunque el usuario no abra Dispositivo:
 * prender la placa es todo lo que hace (ADR 0003).
 *
 * Qué hace solo:
 * - **Conecta por BLE al arrancar y reconecta** si el enlace se cae (con espera creciente). El único
 *   permiso que ve el usuario es el de Bluetooth del sistema, la primera vez.
 * - **Se une al WiFi de la placa** cuando ella enciende su punto de acceso (lo hace al activar un
 *   modo), con las credenciales que llegan por BLE, y sale cuando lo apaga. Cero configuración.
 * - **Sincroniza el modo**: la app se lo escribe a la placa y refleja el que la placa informe.
 *
 * REGLA DE FRONTERA (ADR 0001): nada de esto está en el camino del reconocimiento de ómnibus, que
 * corre local. La placa es una fuente de imagen más; sin ella, la cámara del teléfono.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { announce } from '@/features/audio/announcer';
import { strings } from '@/i18n';
import {
  BleDeviceNotFoundError,
  BleNotImplementedError,
  getBleClient,
} from '@/services/ble/bleClient';
import { codificarBase64 } from '@/services/ble/transferencia';
import { descargarFotoDeLaPlaca, type FotoDeLaPlaca } from '@/services/camera';
import { urlDeLaPlaca } from '@/services/wifi/descargaHttp';
import { WifiNoDisponibleError, esperarPlaca, salirDelWifi, unirseAlWifi } from '@/services/wifi/unirse';

import { MODO_DESDE_GATT, MODO_GATT, type CredencialesWifi, type EstadoDispositivo } from './gatt';
import type { ConnectionState, DeviceInfo } from './types';

export type EstadoWifi = 'sin-red' | 'uniendose' | 'listo' | 'error';
export type ModoDispositivo = (typeof MODO_DESDE_GATT)[number];

export interface Direccion {
  ip: string;
  puerto: number;
}

interface DispositivoValue {
  conexion: ConnectionState;
  /** Dónde está la placa en la red ahora (cambia cuando enciende su AP). */
  direccion: Direccion | null;
  wifi: EstadoWifi;
  /** Por qué la red está en error, para la pantalla y la voz; null si no hay error. */
  wifiDetalle: string | null;
  /** True cuando se puede pedir una foto por WiFi: conectada, con red y `/salud` respondiendo. */
  fotoDisponible: boolean;
  /** True mientras la placa es punto de acceso (con un modo activo). */
  ap: boolean;
  /** Último modo informado por la placa, o null si no informó. */
  modoDispositivo: ModoDispositivo | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  escribirModo: (modo: ModoDispositivo) => Promise<void>;
  descargarFoto: () => Promise<FotoDeLaPlaca>;
  /** Manda el MP3 de una lectura al parlante de la placa. Best-effort: nunca lanza. */
  enviarAudio: (uri: string) => Promise<boolean>;
}

const DispositivoContext = createContext<DispositivoValue | null>(null);

const conexionInicial: ConnectionState = { status: 'idle', device: null, message: strings.connection.idle };

// Reconexión: primero rápido (la placa acaba de reiniciar), después sin insistir (batería del teléfono).
const REINTENTOS_MS = [3_000, 5_000, 10_000, 20_000, 30_000];

function mensajeDeError(err: unknown): string {
  if (err instanceof BleNotImplementedError) return strings.connection.unavailable;
  if (err instanceof BleDeviceNotFoundError) return strings.connection.notFound;
  return strings.connection.error;
}

export function DispositivoProvider({ children }: { children: React.ReactNode }) {
  const [conexion, setConexion] = useState<ConnectionState>(conexionInicial);
  const [direccion, setDireccion] = useState<Direccion | null>(null);
  const [ap, setAp] = useState(false);
  const [wifi, setWifi] = useState<EstadoWifi>('sin-red');
  const [wifiDetalle, setWifiDetalle] = useState<string | null>(null);
  const [modoDispositivo, setModoDispositivo] = useState<ModoDispositivo | null>(null);

  const credenciales = useRef<CredencialesWifi | null>(null);
  const unidoA = useRef<string | null>(null);
  const autoconexion = useRef(true);
  const reintento = useRef(0);
  const conectando = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // La función de conectar se referencia desde el temporizador de reintento, que se define antes:
  // por eso va en un ref y no se captura directo.
  const conectarRef = useRef<() => Promise<void>>(async () => {});
  const sincronizacionRed = useRef(0);

  /**
   * La red sigue al AP: unirse cuando la placa lo enciende, salir cuando lo apaga, y comprobar que
   * la placa responde antes de declarar la foto disponible. Se llama desde los manejadores de
   * eventos (conexión, estado nuevo), nunca desde un efecto. Cada corrida lleva un número: si la
   * situación cambió mientras esperaba, sus resultados se descartan.
   */
  const fallarRed = useCallback((detalle: string) => {
    setWifi('error');
    setWifiDetalle(detalle);
    // La voz es la interfaz: un fallo silencioso deja al usuario esperando un botón que no llega.
    announce(`${strings.connect.wifiFailedAnnounce} ${detalle}`);
  }, []);

  const sincronizarRed = useCallback(
    async (apActivo: boolean, destino: Direccion | null) => {
      const corrida = ++sincronizacionRed.current;
      const vigente = () => corrida === sincronizacionRed.current;
      setWifiDetalle(null);
      if (!destino) {
        setWifi('sin-red');
        return;
      }
      if (apActivo && !credenciales.current) {
        // La placa encendió su AP pero la app no tiene sus credenciales: casi siempre es la caché de
        // GATT de iOS sirviendo una lista de características anterior a `wifi` (2026-09-05). Se vuelve
        // a leer una vez; si sigue vacía, se le dice al usuario el remedio, que es suyo.
        credenciales.current = await getBleClient().leerWifi().catch(() => null);
        if (!vigente()) return;
        if (!credenciales.current) {
          fallarRed(strings.connect.wifiNoCredentials);
          return;
        }
      }
      if (apActivo && credenciales.current && unidoA.current !== credenciales.current.ssid) {
        setWifi('uniendose');
        try {
          await unirseAlWifi(credenciales.current);
          unidoA.current = credenciales.current.ssid;
        } catch (err) {
          if (!vigente()) return;
          fallarRed(
            err instanceof WifiNoDisponibleError
              ? strings.connect.wifiModuleMissing
              : `${strings.connect.wifiJoinFailed} ${err instanceof Error ? err.message : String(err)}`
          );
          return;
        }
      }
      if (!apActivo && unidoA.current) {
        await salirDelWifi(unidoA.current);
        unidoA.current = null;
      }
      if (!vigente()) return;
      setWifi('uniendose');
      const responde = await esperarPlaca(destino);
      if (!vigente()) return;
      if (responde) {
        setWifi('listo');
        announce(strings.connect.wifiReadyAnnounce);
      } else {
        fallarRed(strings.connect.wifiNoResponse.replace('{ip}', destino.ip));
      }
    },
    [fallarRed]
  );

  /**
   * La placa avisa por BLE que su AP cambia ANTES de cambiar de red: desde ese instante la dirección
   * vieja no sirve y el botón del dispositivo tiene que desaparecer hasta que `estado` traiga la
   * nueva y `/salud` responda. Sin esto, un toque en esos segundos moría esperando 20 s
   * (2026-09-05, primera prueba del flujo).
   */
  const empezarTransicionDeRed = useCallback(() => {
    sincronizacionRed.current += 1;
    setDireccion(null);
    setWifi('uniendose');
    setWifiDetalle(null);
  }, []);

  const aplicarEstado = useCallback(
    (estado: EstadoDispositivo) => {
      const destino = estado.ip && estado.puerto ? { ip: estado.ip, puerto: estado.puerto } : null;
      setAp(estado.ap);
      setDireccion(destino);
      setConexion((c) =>
        c.device ? { ...c, device: { ...c.device, batteryLevel: estado.bateria, firmwareVersion: estado.version } } : c
      );
      void sincronizarRed(estado.ap, destino);
    },
    [sincronizarRed]
  );

  const programarReintento = useCallback(() => {
    if (!autoconexion.current || timer.current) return;
    const espera = REINTENTOS_MS[Math.min(reintento.current, REINTENTOS_MS.length - 1)];
    reintento.current += 1;
    timer.current = setTimeout(() => {
      timer.current = null;
      void conectarRef.current();
    }, espera);
  }, []);

  const conectarInterno = useCallback(async () => {
    if (conectando.current) return;
    conectando.current = true;
    setConexion({ status: 'scanning', device: null, message: strings.connection.scanning });
    try {
      const cliente = getBleClient();
      const device: DeviceInfo = await cliente.connect();
      reintento.current = 0;
      setConexion({ status: 'connected', device, message: strings.connection.connected });
      setDireccion(device.direccion);
      setAp(device.ap);
      credenciales.current = await cliente.leerWifi().catch(() => null);
      void sincronizarRed(device.ap, device.direccion);
    } catch (err) {
      setConexion({ status: 'error', device: null, message: mensajeDeError(err) });
      // Sin módulo nativo no hay nada que reintentar: la app corre sin placa.
      if (!(err instanceof BleNotImplementedError)) programarReintento();
    } finally {
      conectando.current = false;
    }
  }, [programarReintento, sincronizarRed]);

  useEffect(() => {
    conectarRef.current = conectarInterno;
  }, [conectarInterno]);

  // Suscripciones al cliente, una sola vez.
  useEffect(() => {
    const cliente = getBleClient();
    const bajas = [
      cliente.onDisconnect(() => {
        sincronizacionRed.current += 1; // invalida cualquier espera de red en curso
        setConexion({ status: 'error', device: null, message: strings.connection.lost });
        setDireccion(null);
        setAp(false);
        setWifi('sin-red');
        programarReintento();
      }),
      cliente.onEstado(aplicarEstado),
      cliente.onModo((valor) => setModoDispositivo(MODO_DESDE_GATT[valor] ?? null)),
      cliente.onAp(empezarTransicionDeRed),
    ];
    // La primera conexión sale del efecto de montaje pero en el siguiente tick: el efecto sólo
    // suscribe; conectar cambia estado y eso no va dentro del efecto.
    const arranque = setTimeout(() => void conectarRef.current(), 0);
    return () => {
      clearTimeout(arranque);
      for (const baja of bajas) baja();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [aplicarEstado, empezarTransicionDeRed, programarReintento]);

  const connect = useCallback(async () => {
    autoconexion.current = true;
    reintento.current = 0;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    await conectarInterno();
  }, [conectarInterno]);

  const disconnect = useCallback(async () => {
    // Desconectar a mano apaga la reconexión hasta que el usuario vuelva a buscar: si no, la app
    // se reconectaría sola un segundo después y el botón no serviría para nada.
    autoconexion.current = false;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (unidoA.current) {
      await salirDelWifi(unidoA.current);
      unidoA.current = null;
    }
    sincronizacionRed.current += 1;
    await getBleClient().disconnect();
    setConexion(conexionInicial);
    setDireccion(null);
    setAp(false);
    setWifi('sin-red');
    setModoDispositivo(null);
  }, []);

  const escribirModo = useCallback(
    async (modo: ModoDispositivo) => {
      if (conexion.status !== 'connected') return;
      try {
        await getBleClient().escribirModo(MODO_GATT[modo]);
        // Cambiar de modo cambia el AP y con él la dirección de la placa: la transición arranca ya.
        if (credenciales.current) empezarTransicionDeRed();
      } catch {
        // La placa no se enteró del modo: la app sigue funcionando con la cámara del teléfono.
      }
    },
    [conexion.status, empezarTransicionDeRed]
  );

  const fotoDisponible = conexion.status === 'connected' && wifi === 'listo' && direccion !== null;

  const descargarFoto = useCallback(async () => {
    if (!direccion) throw new Error(strings.connect.measureWifiNoAddress);
    return descargarFotoDeLaPlaca(direccion);
  }, [direccion]);

  const enviarAudio = useCallback(
    async (uri: string): Promise<boolean> => {
      if (!fotoDisponible || !direccion) return false;
      try {
        const { File } = await import('expo-file-system');
        const bytes = new Uint8Array(await new File(uri).arrayBuffer());
        // El cuerpo va en base64 porque `fetch` de React Native no manda bytes crudos; la placa lo
        // decodifica por el header.
        const r = await fetch(urlDeLaPlaca(direccion, '/audio'), {
          method: 'POST',
          headers: { 'Content-Type': 'audio/mpeg', 'X-Encoding': 'base64' },
          body: codificarBase64(bytes),
        });
        return r.ok;
      } catch {
        return false;
      }
    },
    [direccion, fotoDisponible]
  );

  const value = useMemo<DispositivoValue>(
    () => ({ conexion, direccion, wifi, wifiDetalle, fotoDisponible, ap, modoDispositivo, connect, disconnect, escribirModo, descargarFoto, enviarAudio }),
    [conexion, direccion, wifi, wifiDetalle, fotoDisponible, ap, modoDispositivo, connect, disconnect, escribirModo, descargarFoto, enviarAudio]
  );

  return <DispositivoContext.Provider value={value}>{children}</DispositivoContext.Provider>;
}

export function useDispositivo(): DispositivoValue {
  const value = useContext(DispositivoContext);
  if (!value) throw new Error('useDispositivo requiere DispositivoProvider');
  return value;
}
