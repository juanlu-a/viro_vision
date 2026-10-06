/**
 * Spanish strings for ViroVision. The app speaks Spanish to its users; the code around it is
 * English, so keys are English and values are Spanish.
 * Keep every user-facing string here so screen-reader labels stay consistent and translatable.
 */
export const es = {
  common: {
    back: 'Atrás',
  },
  app: {
    name: 'ViroVision',
    tagline: 'Asistente de reconocimiento por voz',
  },
  tabs: {
    home: 'Inicio',
    device: 'Dispositivo',
    settings: 'Ajustes',
  },
  reader: {
    // Screen reader only: on screen the mode name stands alone. The caption is what turns
    // «Esperando» into something that says what is waiting.
    modeLabel: 'Modo',
    modeIdle: 'Esperando',
    modeBus: 'Modo ómnibus',
    modeSupermarket: 'Modo supermercado',
    modeBusOn: 'Activar modo ómnibus',
    modeBusOnHint:
      'Equivale a un click del botón del dispositivo. Lee el cartel de un ómnibus con el OCR local, sin internet.',
    modeBusOff: 'Desactivar modo ómnibus',
    modeSuperOn: 'Activar modo supermercado',
    modeSuperOnHint:
      'Equivale a dos clicks del botón del dispositivo. Identifica un producto con un modelo de visión en la nube; necesita internet.',
    modeSuperOff: 'Desactivar modo supermercado',
    modeOffHint: 'Equivale a un click largo del botón: vuelve a esperando y apaga el reconocimiento.',
    announceIdle: 'Esperando. Reconocimiento apagado.',
    announceBus: 'Modo ómnibus activado.',
    announceBusWarmingUp: 'Modo ómnibus. Preparando la lectura, esperá unos segundos.',
    announceBusApproaching: 'Se acerca un ómnibus.',
    announceSupermarket: 'Modo supermercado activado.',
    readWithDeviceButton: 'Leer con el dispositivo',
    readWithDeviceHint:
      'La cámara del dispositivo saca la foto y la manda al teléfono por WiFi; el resultado se anuncia en voz alta.',
    readNeedsDeviceHint:
      'Para leer hace falta el dispositivo prendido y cerca. Fijate en la pestaña Dispositivo en qué anda.',
    readingFromDevice: 'Pidiendo la foto al dispositivo…',
    deviceCaptureFailed: 'El dispositivo no pudo sacar la foto. Probá de nuevo.',
    preparing: 'Preparando el lector… la primera vez descarga unos 250 MB.',
    reading: 'Leyendo…',
    line: 'Línea',
    nothingRead: 'No pude leer el cartel. Probá con una foto más de cerca.',
    // «Elemento no reconocible» y no «no pude identificar el producto»: desde el 2026-09-11 el modo
    // no se limita a productos envasados —identifica cualquier alimento— así que «producto» era
    // angosto, y esto también cubre el caso de apuntar a algo que no es un alimento. Conserva el qué
    // hacer: quien no ve la pantalla no tiene otra forma de saber que hay un remedio.
    nothingReadProduct: 'Elemento no reconocible. Probá con una foto más de cerca.',
    error: 'No pude leer. Probá de nuevo.',
    readTimedOut: 'Tardó demasiado. Probá de nuevo.',
    quotaExhausted: 'El modo supermercado está ocupado. Probá de nuevo en',
    seconds: 'segundos.',
    waitingSlot: 'Esperando cupo del modelo. Sigo en',
    cloudNotConfigured: 'El modo supermercado no está disponible en esta versión. Podés seguir usando el modo ómnibus.',
    cloudUnavailable: 'Sin conexión a internet. El modo supermercado necesita internet; probá de nuevo cuando tengas señal.',
    cloudFailed: 'La nube no respondió. Probá de nuevo en un momento.',
    modelLabel: 'Modelo seleccionado',
    modelSelect: 'Seleccionar modelo',
    modelHint: 'Elegí qué modelo de visión en la nube identifica los productos. Se guarda en el teléfono.',
    modelProvider: 'Proveedor',
    resultLabel: 'Última lectura',
    photoLabel: 'Foto del dispositivo',
    photoHint: 'La imagen que capturó la cámara del dispositivo para esta lectura.',
    productField: 'Producto',
    brandField: 'Marca',
    detailField: 'Detalle',
    destinationField: 'Destino',
    fieldUnread: 'sin leer',
  },
  home: {
    title: 'ViroVision',
    subtitle: 'Identifica líneas de ómnibus y productos, y te lo dice en voz alta.',
    howItWorks: 'Qué reconoce',
    useBus: 'Líneas de ómnibus',
    useBusDesc: 'Te dice qué ómnibus se aproxima.',
    useProduct: 'Productos de supermercado',
    useProductDesc: 'Identifica alimentos y productos de supermercado.',
    testAudioButton: 'Probar audio',
    testAudioHint: 'Reproduce un mensaje de prueba para verificar la salida de voz.',
    testAudioPhrase: 'Hola, soy ViroVision. La salida de audio funciona correctamente.',
  },
  connect: {
    title: 'Dispositivo',
    intro: 'Vincula el dispositivo de ViroVision para recibir los resultados de reconocimiento.',
    statusLabel: 'Estado del dispositivo',
    scanButton: 'Buscar dispositivo',
    scanHint: 'Comienza a buscar el dispositivo de ViroVision por Bluetooth.',
    disconnectButton: 'Desconectar',
    disconnectHint: 'Corta la conexión con el dispositivo.',
    deviceSection: 'Dispositivo conectado',
    deviceSimulated: 'Datos simulados: no hay un dispositivo real conectado.',
    deviceNameLabel: 'Nombre',
    deviceUnnamed: 'Sin nombre',
    batteryLabel: 'Batería',
    batteryUnknown: 'todavía sin informar',
    batteryLow: 'batería baja',
    wifiReadyAnnounce: 'Red con el dispositivo lista.',
    // Sin el motivo, a propósito (2026-10-06): qué paso de la unión falló, la IP o el texto del
    // sistema van a la telemetría. Al oído llega sólo que falta la red y qué se puede hacer.
    wifiFailedAnnounce: 'Todavía no pude conectarme a la red del dispositivo. Sigo intentando.',
  },
  settings: {
    title: 'Ajustes',
    intro: 'Configuración de accesibilidad, voz y dispositivo.',
    audioOutput: 'Dónde se escucha',
    audioOutputHint:
      'Elegí si los modos y las lecturas se escuchan por el teléfono o por el parlante del dispositivo.',
    audioOutputPhone: 'En el teléfono',
    audioOutputPhoneHint:
      'Los modos y las lecturas salen por el teléfono, al instante y sin internet. Es lo que funciona siempre.',
    audioOutputDevice: 'En el dispositivo',
    audioOutputDeviceHint:
      'Los modos y las lecturas salen por el parlante del dispositivo. Los anuncios de modo y el modo ómnibus están grabados y no necesitan internet; sólo la lectura del supermercado se sintetiza en la nube y tarda un poco más. Si el dispositivo no está disponible, suena en el teléfono.',
    // El reparto quedó fijado el 2026-09-17 (ADR 0003): la conexión y la red las dice SIEMPRE el
    // teléfono, porque cuando se anuncian el dispositivo recién existe para la app y el usuario está
    // emparejando con el teléfono en la mano. La nota dice lo que este ajuste NO alcanza, que es lo
    // único que puede sorprender.
    audioOutputBusNote:
      'Los avisos de conexión y de red se escuchan siempre en el teléfono. En el dispositivo los anuncios de modo están grabados, así que funcionan sin internet.',
    // La confirmación del selector, entera por destino: es el texto que el teléfono dice y también
    // el que está grabado en la placa (`hardware/raspi/virovision/notices.py`), y los dos tienen que
    // decir lo mismo o el usuario escucha una frase distinta según dónde la escuche.
    audioOutputSetToPhone: 'Dónde se escucha: en el teléfono.',
    audioOutputSetToDevice: 'Dónde se escucha: en el dispositivo.',
    audioOutputNotConfigured: 'En esta versión la lectura del supermercado va a sonar en el teléfono.',
  },
  auth: {
    loading: 'Cargando sesión…',
    signingIn: 'Iniciando sesión…',
    signedOut: 'Sesión no iniciada',
    signedIn: 'Sesión iniciada',
    error: 'No se pudo iniciar sesión. Revisa tu correo y contraseña.',
    // Honest placeholder until Supabase is configured (see ADR 0002).
    notConfigured: 'El inicio de sesión aún no está configurado.',
    confirmEmail: 'Cuenta creada. Revisa tu correo para confirmarla.',
    emailLabel: 'Correo electrónico',
    emailHint: 'Ingresa tu dirección de correo electrónico.',
    passwordLabel: 'Contraseña',
    passwordHint: 'Ingresa tu contraseña.',
    signIn: 'Iniciar sesión',
    signInHint: 'Inicia sesión con tu correo y contraseña.',
    signUp: 'Crear cuenta',
    signUpHint: 'Crea una cuenta nueva con tu correo y contraseña.',
    signOut: 'Cerrar sesión',
    signOutHint: 'Cierra tu sesión en este dispositivo.',
  },
  // La pantalla que reemplaza a una que se rompió al dibujarse (2026-10-06). Sin la palabra «error»
  // ni ningún detalle, a propósito: el detalle va a la telemetría y al usuario le llega sólo qué hacer.
  recovery: {
    message: 'Volvamos a empezar.',
    restart: 'Volver a empezar',
    restartHint: 'Vuelve a cargar la pantalla.',
  },
  connection: {
    idle: 'Sin conectar',
    scanning: 'Buscando dispositivo…',
    connecting: 'Conectando…',
    connected: 'Conectado',
    // Dicho en voz alta, no mostrado: «Conectado» a secas alcanza en pantalla, donde está al lado
    // del nombre del dispositivo, pero suelto en el oído no dice conectado a qué.
    connectedAnnounce: 'Dispositivo conectado.',
    // Amber on the Device tab: the Bluetooth link is up but the photo path is not. Only what is
    // missing, in brackets; the reason and the remedy go in the notice below, not here.
    connectedWithoutWifi: 'Conectado (falta el WiFi)',
    error: 'Sin conectar. Sigo buscando el dispositivo.',
    notFound: 'No encontré el dispositivo. Fijate que esté prendido y cerca.',
    radioOff: 'No puedo usar el Bluetooth del teléfono. Fijate que esté prendido y que ViroVision tenga permiso.',
    lost: 'Se perdió la conexión con el dispositivo. Buscalo de nuevo.',
    // Expo Go and web lack the native Bluetooth module; the real client needs a development build.
    unavailable: 'Esta versión de la app no puede usar Bluetooth.',
  },
} as const;

export type Strings = typeof es;
