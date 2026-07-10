/**
 * Spanish strings for ViroVision. Spanish is the project's primary language.
 * Keep every user-facing string here so screen-reader labels stay consistent and translatable.
 */
export const es = {
  app: {
    name: 'ViroVision',
    tagline: 'Asistente de reconocimiento por voz',
  },
  home: {
    title: 'ViroVision',
    subtitle: 'Identifica líneas de ómnibus y productos, y te lo dice en voz alta.',
    connectButton: 'Conectar dispositivo',
    connectHint: 'Abre la pantalla para vincular el dispositivo de ViroVision por Bluetooth.',
    settingsButton: 'Ajustes',
    settingsHint: 'Abre la configuración de la aplicación.',
    testAudioButton: 'Probar audio',
    testAudioHint: 'Reproduce un mensaje de prueba para verificar la salida de voz.',
    testAudioPhrase: 'Hola, soy ViroVision. La salida de audio funciona correctamente.',
    deviceStatusLabel: 'Estado del dispositivo',
  },
  connect: {
    title: 'Conectar dispositivo',
    intro: 'Vincula el dispositivo de ViroVision para recibir los resultados de reconocimiento.',
    scanButton: 'Buscar dispositivo',
    scanHint: 'Comienza a buscar el dispositivo de ViroVision por Bluetooth.',
    disconnectButton: 'Desconectar',
    disconnectHint: 'Corta la conexión con el dispositivo.',
  },
  settings: {
    title: 'Ajustes',
    intro: 'Configuración de accesibilidad, voz y dispositivo.',
    account: 'Cuenta',
    comingSoon: 'Próximamente.',
  },
  auth: {
    loading: 'Cargando sesión…',
    signedOut: 'Sesión no iniciada',
    signedIn: 'Sesión iniciada',
    error: 'No se pudo iniciar sesión',
    // Honest placeholder until Supabase is configured (see ADR 0002).
    notConfigured: 'El inicio de sesión aún no está configurado.',
    signInWithGoogle: 'Iniciar sesión con Google',
    signInHint: 'Inicia sesión con tu cuenta de Google. Requiere conexión a internet.',
    signOut: 'Cerrar sesión',
    signOutHint: 'Cierra tu sesión en este dispositivo.',
  },
  connection: {
    idle: 'Sin conectar',
    scanning: 'Buscando dispositivo…',
    connecting: 'Conectando…',
    connected: 'Conectado',
    error: 'Error de conexión',
    // Honest placeholder until the BLE/GATT layer is implemented.
    unavailable: 'La conexión Bluetooth aún no está implementada.',
  },
} as const;

export type Strings = typeof es;
