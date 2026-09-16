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

## 8.7 Despliegue en el dispositivo

El software del dispositivo se instala mediante un **único script de despliegue** que copia el
paquete, instala las dependencias y reinicia el servicio. El servicio se gestiona con systemd y
arranca automáticamente al encender la placa.

**Configuración persistente.** Las banderas de ejecución residen en un archivo de configuración del
sistema, fuera del paquete, para sobrevivir a las actualizaciones.

**Interruptor de modo de red.** El dispositivo tiene dos comportamientos posibles: modo de desarrollo
(se une a una red conocida y es accesible por SSH) y modo de producto (levanta su propio punto de
acceso). El interruptor entre ambos es **la presencia de un archivo en la partición de arranque de la
tarjeta de memoria**, lo que permite cambiarlo insertando la tarjeta en cualquier computadora, sin
acceso por red. Un defecto encontrado durante el desarrollo dejó una lección registrada: la bandera
antigua estaba fijada en dos archivos distintos de esa partición, y buscarla sólo en el archivo
evidente no alcanzó.

**El pipeline de visión** se instala en la placa como dependencia desde su repositorio propio, lo que
mantiene el ciclo de trabajo del pilar de ML independiente del ciclo del dispositivo.

**Punto de acceso.** El dispositivo publica una red propia con configuración de alcance local. Una
corrección necesaria fue eliminar de la configuración las opciones que anuncian puerta de enlace y
servidor de nombres: sin ese ajuste, el teléfono que se unía a la red del dispositivo **quedaba sin
acceso a internet**, lo que impedía alcanzar la nube en el modo supermercado.

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
