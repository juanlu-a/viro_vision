# 8. Despliegue de la solución

Este capítulo describe cómo el sistema llega desde el repositorio hasta el usuario: los canales de
distribución de la aplicación móvil, la publicación de los servicios de nube y la instalación del
software en el dispositivo físico.

## 8.1 Stack de despliegue

| Función | Herramienta |
|---|---|
| Control de versiones y alojamiento | Git · GitHub |
| Integración y entrega continua | GitHub Actions |
| Distribución iOS | App Store Connect API · TestFlight |
| Distribución Android | Google Play Console (canales de prueba interna y cerrada) |
| Servicios de nube | Supabase (funciones en el borde y base de datos PostgreSQL) |
| Dispositivo | Script de despliegue por SSH · servicio systemd |

## 8.2 Modelo de ramas y canales

El proyecto asocia **cada rama de larga vida a un canal de distribución real**, de modo que fusionar
es publicar:

| Rama | Canal iOS | Canal Android | Audiencia |
|---|---|---|---|
| `staging` | TestFlight, grupo interno | Play, prueba interna | El equipo |
| `main` | TestFlight, enlace público | Play, prueba cerrada | Testers externos y tutor |

Esta correspondencia tiene una consecuencia deliberada: **no existe un paso manual de publicación**.
Un cambio aprobado y fusionado está, en minutos, instalado en los teléfonos del equipo. El costo de
esa automatización es que la rama `staging` debe mantenerse siempre en estado publicable, lo que
justifica los controles de calidad de §8.3.

## 8.3 Integración continua

El flujo de integración se ejecuta en cada *pull request* y en cada empuje a una rama de trabajo, y
tiene dos etapas:

1. **Calidad**: instalación determinista de dependencias, análisis estático, verificación de tipos y
   la suite completa de pruebas.
2. **Compilación de verificación**: exportación del paquete para ambas plataformas, que confirma que
   el proyecto compila de punta a punta antes de invertir treinta minutos en un build real.

### 8.3.1 Un control de calidad no evidente

Además de los controles habituales, el flujo ejecuta una **verificación de correspondencia entre los
modelos ofrecidos y las credenciales configuradas**. Existe por un fallo real: cuando un proveedor
salió del selector de modelos, la única credencial que el repositorio tenía configurada dejó de
corresponder a un modelo del registro. La compilación fue exitosa, el paquete se publicó al canal de
pruebas, y **el modo supermercado quedó sin ningún modelo disponible**. La aplicación degradó
correctamente (anunció que no estaba configurada y no falló) pero nadie se enteró hasta abrirla.

El control compara los proveedores que el código ofrece contra las credenciales presentes en el
entorno y **detiene la publicación antes del build**. Es un ejemplo de una clase de defecto que
ninguna prueba unitaria detecta, porque no está en el código sino en la relación entre el código y
su configuración de despliegue.

El repositorio codifica además una regla de seguridad explícita sobre credenciales: **una credencial
de un servicio gratuito sin tarjeta asociada puede viajar en el paquete; una credencial de un
servicio pago, no**. El peor caso de la primera es una cuota consumida que se repone; el de la
segunda es el medio de pago del proyecto.

## 8.4 Distribución iOS

La publicación se ejecuta sobre un ejecutor macOS y comprende: verificación de credenciales,
controles de calidad, obtención de la clave de la API de App Store Connect, **firma manual** con
certificado y perfil de aprovisionamiento propios, generación del proyecto nativo, compilación,
archivado y subida.

**Sobre la firma manual.** El proyecto usó inicialmente firma gestionada automáticamente por el
servicio de compilación. La consecuencia fue un defecto particularmente difícil de diagnosticar: el
archivo se exportaba **sin los permisos especiales declarados en el proyecto**, de modo que la
aplicación compilaba, se subía y se instalaba correctamente, pero la función de unión automática a
la red WiFi del dispositivo fallaba en el teléfono con un error interno. Desde entonces la firma se
realiza explícitamente con el certificado y el perfil del equipo.

El número de compilación se deriva de una marca temporal, y no de un versionado semántico, porque su
única función es ordenar builds dentro del canal de distribución.

**Sobre el servicio de compilación gestionado.** Están configurados los perfiles del servicio de
build en la nube del framework, pero permanecen deshabilitados: la distribución efectiva se realiza
con las herramientas nativas desde el ejecutor de integración continua, sin depender de un servicio
de terceros ni consumir su cuota.

## 8.5 Distribución Android

El flujo Android genera el paquete de aplicación firmado con la clave de subida del proyecto y lo
publica al canal correspondiente según la rama. Se mantiene además un flujo que produce un paquete
instalable directamente, porque el formato que exige la tienda no se puede instalar en un teléfono
para una prueba rápida. Los artefactos se nombran con versión y número de compilación: un nombre
genérico no permite distinguir dos builds compartidos en una conversación.

## 8.6 Servicios de nube

### 8.6.1 Función de proxy de visión

Desplegada y activa desde el 2 de septiembre de 2026. Su diseño está descrito en §7.2.3. Desde el
punto de vista del despliegue interesan tres aspectos:

- **Las credenciales viven en el almacén de secretos del proyecto**, nunca en el repositorio ni en el
  paquete de la aplicación. La dirección del proxy es el único valor de configuración que el binario
  necesita, y no es sensible.
- **Los códigos de error se eligieron para que el cliente pueda reaccionar**: 400 ante un destino que
  no figura en la lista blanca, 405 ante un método incorrecto, 502 si no se alcanza al proveedor, y
  **503 (y no 500) cuando falta una credencial**, porque el servicio no está roto sino sin
  configurar, y el mensaje nombra cuál falta. El limitador devuelve 429 con el mismo código de error
  que usan los proveedores, de modo que el cliente ya sabe esperar en lugar de abortar.
- **Limitación conocida**: el limitador por dirección de origen mantiene su contador en memoria del
  proceso, y la plataforma ejecuta varias instancias simultáneas, cada una con su propio contador.
  Está documentado como un obstáculo y no como una barrera.

### 8.6.2 Función de telemetría y base de datos

Recibe lotes de eventos y los inserta en la tabla correspondiente utilizando una credencial de
servicio, de modo que la aplicación nunca posee acceso directo a la base. Aplica dos topes: cien
eventos por lote y un tamaño máximo por detalle, que al superarse **se reemplaza por completo** y no
parcialmente, porque un detalle sobredimensionado es la señal de que algo no debería estar
enviándose por ese canal.

La tabla de eventos tiene **seguridad a nivel de fila habilitada y ninguna política definida, a
propósito**: con la clave pública una consulta devuelve un conjunto vacío. La advertencia quedó
escrita en la documentación del backend: la clave pública viaja dentro del paquete de la aplicación,
de modo que una política de lectura para el rol anónimo es una política para cualquiera que la
extraiga.

El esquema se gestiona por **migraciones que se agregan y no se editan**. La migración que tradujo
los nombres al inglés (ADR 0009) **renombró en lugar de recrear**, para no perder los registros de
las primeras sesiones de campo, que son el único diagnóstico disponible de esa etapa.

### 8.6.3 Riesgo operativo declarado

El nivel gratuito de la plataforma **pausa los proyectos sin actividad durante una semana**, y ya
ocurrió una vez. Con el proxy en producción y sin credenciales embebidas en la aplicación, una pausa
deja sin modo supermercado a **todas las versiones distribuidas simultáneamente**. Es una dependencia
de disponibilidad que el proyecto asume conscientemente y que debe monitorearse.

## 8.7 Instalación y operación del dispositivo

Desplegar sobre un dispositivo embebido sin pantalla y sin teclado es un problema distinto de
publicar una aplicación móvil, y consumió una proporción del esfuerzo del proyecto que no se anticipó
al planificar. Esta sección documenta el procedimiento que quedó establecido y, sobre todo, las
restricciones que lo determinaron, porque ninguna de ellas se deduce del código.

### 8.7.1 La tarjeta de memoria como panel de control

La tarjeta que corre en el dispositivo tiene una partición de arranque en formato FAT, legible y
escribible desde cualquier computadora. El proyecto la usa deliberadamente como **superficie de
administración**: el modo de red, los perfiles de red inalámbrica y los archivos de audio de los
avisos de sistema se instalan dejando archivos en esa partición, que un servicio lee en cada
arranque.

La razón es la restricción de §7.3.4: **un dispositivo en modo producto no tiene acceso remoto**, de
modo que si la única vía de administración fuera la red, cualquier error de configuración dejaría al
dispositivo irrecuperable sin desarmarlo.

| Se deja en la partición de arranque | Efecto en el siguiente arranque |
|---|---|
| El archivo interruptor de modo de red | Selecciona modo desarrollo o modo producto |
| Un perfil de red inalámbrica | Se instala y queda disponible; el gestor de red conserva todos los perfiles y se une al que esté presente |
| Una carpeta con los audios de avisos de sistema | Se copian al repertorio del dispositivo |

El dispositivo conserva **varios perfiles de red** simultáneos, uno por cada entorno donde se
trabajó. Es la diferencia entre poder llevarlo a probar a otro lugar y tener que reconfigurarlo.

### 8.7.2 Vías de acceso y la regla que las ordena

Existen tres formas de alcanzar el dispositivo, y no son equivalentes:

| Vía | Cuándo sirve | Limitación |
|---|---|---|
| **Red inalámbrica conocida** (modo desarrollo) | Trabajo habitual | Exige que el dispositivo esté en modo desarrollo |
| **Cable de red** | Siempre, incluso en modo producto | La placa definitiva del proyecto no tiene conector de red; sólo la placa de reemplazo actual |
| **Unirse al punto de acceso del dispositivo** | Cualquier modo | **Desaconsejado**, ver abajo |

La regla operativa que el proyecto adoptó, después de perder sesiones a mitad de una copia de
archivos, es: **no desplegar desde una máquina con una sola interfaz de red**. Un equipo que sólo
tiene radio inalámbrica, al unirse al punto de acceso del dispositivo, se queda sin salida a internet;
y el sistema operativo, al detectar una red sin salida, **vuelve solo a la red conocida**, de modo
que la conexión no se sostiene. Una transferencia cortada por la mitad deja el servicio del
dispositivo en un estado inconsistente.

El punto de acceso **sí acepta conexiones remotas**: lo que se pierde al unirse a él no es el acceso
al dispositivo sino el acceso a internet de la máquina, porque la red se publica deliberadamente sin
anunciar puerta de enlace ni servidor de nombres (§8.7.5).

**Configuración de la vía por cable.** La interfaz de red del dispositivo tiene dirección fija, y la
computadora actúa como encaminador mediante una regla de traducción de direcciones. Se optó por
dirección fija y no por asignación dinámica porque, si el dispositivo solicita configuración y nadie
responde, el gestor de red da la conexión por fallida y el dispositivo **desaparece del enlace** hasta
que se vuelve a conectar el cable físicamente.

### 8.7.3 El procedimiento de despliegue

El procedimiento verificado consta de cinco pasos y su orden importa:

1. **Pasar el dispositivo a modo desarrollo** desde la tarjeta, y arrancar.
2. **Alcanzarlo por la red conocida** y detener el servicio.
3. **Instalar la versión nueva del paquete**, conservando un respaldo de la anterior y verificando
   que el paquete importe correctamente **antes** de arrancar el servicio.
4. **Actualizar la configuración de arranque** y dejar el paquete también en la partición de la
   tarjeta, de modo que una instalación desde cero no necesite conectividad.
5. **Verificar** contra el punto de consulta de salud del dispositivo y **volver a modo producto**.

Tres restricciones de este procedimiento se descubrieron a fuerza de tropezar con ellas:

- **El instalador automático no se vuelve a ejecutar.** Está protegido por un archivo centinela que
  ya existe, y ese centinela vive en la partición del sistema, no en la de arranque, por lo que **no
  se puede borrar desde otra computadora con la tarjeta puesta**. Dejar una versión nueva del paquete
  en la tarjeta no alcanza: hay que instalarla por acceso remoto.
- **El paquete debe llevar el árbol completo**, y no sólo el módulo de la aplicación. Un paquete
  incompleto instala un servicio a medias, y el síntoma aparece mucho después, sin nada que lo
  vincule con el día en que se armó mal.
- **Una bandera de configuración puede estar repetida en dos archivos distintos.** Al renombrar las
  banderas por el cambio de idioma (ADR 0009), se corrigió la ocurrencia evidente y la otra volvió a
  imponerse en el arranque siguiente. La lección quedó escrita: buscar en **toda** la partición, no en
  el archivo obvio.

Adicionalmente, el dispositivo **no tiene reloj de tiempo real**: arranca creyendo que es la hora del
último apagado. Hasta que el reloj se sincroniza por red, el gestor de paquetes rechaza operaciones
por considerar los metadatos no vigentes. Por eso el procedimiento evita instalar dependencias
mientras no cambien, y se apoya en el entorno virtual ya construido en el dispositivo.

### 8.7.4 Diagnóstico y sus límites

El registro del servicio es el **único diagnóstico disponible** del dispositivo en uso real: no hay
pantalla, y el usuario no puede describir lo que vio.

Aquí el proyecto tiene un problema **identificado y no resuelto**, y conviene declararlo: aunque el
registro está configurado como persistente, sólo se conserva visible el último arranque. La causa es
la misma ausencia de reloj de tiempo real: las marcas de tiempo saltan cuando la sincronización
corrige la hora a mitad del arranque, y los arranques anteriores desaparecen de la vista. **Se perdió
así el registro de la única prueba realizada en modo producto.** Para un dispositivo cuyo único
diagnóstico es el registro, resolverlo es condición previa a las pruebas en la calle.

El proyecto compensa parcialmente esta limitación por dos vías: la **telemetría** que envía la
aplicación móvil (§7.8.3), que sí persiste y está fechada del lado del servidor, y una herramienta
que **reproduce todos los avisos de sistema en secuencia** para verificar el repertorio de audio sin
necesidad del teléfono.

Una precaución adicional, registrada porque costó tiempo: el servicio **toma la cámara al arrancar**,
de modo que cualquier prueba manual de la cámara exige detenerlo primero y volver a iniciarlo al
terminar.

### 8.7.5 El punto de acceso y la conectividad del teléfono

El dispositivo publica una red propia protegida con clave compartida. Una corrección necesaria fue
**eliminar de su configuración las opciones que anuncian puerta de enlace y servidor de nombres**: sin
ese ajuste, el teléfono que se unía a la red del dispositivo enrutaba todo su tráfico por ella y
quedaba sin acceso a internet, lo que impedía alcanzar la nube en el modo supermercado. La red queda
así declarada como de alcance estrictamente local, y el teléfono conserva su conexión de datos.

Por la misma razón, el punto de acceso tampoco sirve como vía de administración desde una máquina de
una sola interfaz (§8.7.2): el comportamiento que protege al teléfono es el que deja sin internet a la
computadora.

### 8.7.6 El pipeline de visión como dependencia

El pipeline de reconocimiento de líneas se instala en el dispositivo **como dependencia desde su
propio repositorio**, y no se copia dentro del paquete del servicio. Esto mantiene el ciclo de trabajo
del pilar de aprendizaje automático (entrenar, evaluar, exportar) independiente del ciclo del
dispositivo, y permite actualizar el modelo sin reinstalar el servicio.

### 8.7.7 Deuda operativa declarada

El procedimiento descrito es reproducible pero no está terminado, y las brechas se declaran porque
condicionan la etapa final:

| Pendiente | Consecuencia |
|---|---|
| La tarjeta en uso **no se instaló con el script de instalación del repositorio**, sino a mano. No existe todavía una imagen reproducible | Reconstruir el dispositivo desde cero no es un procedimiento verificado |
| El registro no sobrevive a los reinicios (§8.7.4) | Una falla en la calle es irrecuperable en cuanto alguien apaga el dispositivo |
| Las credenciales de administración del dispositivo se compartieron por un canal no seguro durante el desarrollo, y una clave de servicio quedó en el historial de un repositorio | Ambas deben rotarse antes de cualquier distribución |
| El sistema de aprovisionamiento automático estándar de la imagen no aplica la configuración de red en esta versión | Todo el andamiaje de configuración descrito existe por eso, y debería revisarse si se actualiza la imagen base |

## 8.8 Estado del despliegue

| Componente | Estado |
|---|---|
| Integración continua | Operativa |
| TestFlight, canal interno y enlace público | Operativo punta a punta |
| Google Play | Configurado; pendiente de verificación de identidad |
| Proxy de visión | **Desplegado y activo** |
| Telemetría y base de datos | Desplegadas |
| Servicio del dispositivo | Instalado y operativo sobre la placa en uso |
| Imagen de tarjeta reproducible del dispositivo | Parcial: la tarjeta en uso no se instaló con el script |
