# 8. Despliegue de la solución

Este capítulo describe cómo el sistema llega desde el repositorio hasta el usuario: los canales de distribución de la aplicación móvil, la publicación de los servicios de nube y la instalación del software en el dispositivo físico.

## 8.1 Stack de despliegue

La Tabla 31 resume las herramientas que intervienen en el despliegue.

Tabla 31: Herramientas del stack de despliegue.

| **Función** | **Herramienta** |
|---|---|
| Control de versiones y alojamiento | Git · GitHub |
| Integración y entrega continua | GitHub Actions |
| Distribución iOS | App Store Connect API · TestFlight |
| Distribución Android | Paquete instalable (.apk) firmado en GitHub Actions; Google Play Console configurada y apagada |
| Servicios de nube | Supabase (funciones en el borde, base de datos PostgreSQL y almacenamiento) |
| Dispositivo | Script de despliegue por SSH · servicio systemd · herramienta de acceso por Bluetooth |

## 8.2 Modelo de ramas y canales

El proyecto asocia cada rama de larga vida a un canal de distribución real, de modo que fusionar es publicar (Tabla 32).

Tabla 32: Ramas de larga vida y su canal de distribución.

| **Rama** | **Canal iOS** | **Canal Android** | **Audiencia** |
|---|---|---|---|
| staging | TestFlight, grupo interno | Paquete .apk como artefacto de la compilación | El equipo |
| main | TestFlight, enlace público | Ninguno mientras Google Play esté apagado | Probadores externos y director |

Google Play tiene los canales de prueba interna (para staging) y cerrada (para main) configurados, pero el flujo permanece apagado por una variable del repositorio mientras la cuenta de la tienda no esté activa (sec. 8.5).

Esta correspondencia tiene una consecuencia deliberada: no existe un paso manual de publicación. Un cambio aprobado e integrado queda disponible en el canal de pruebas correspondiente. El costo de esa automatización es que la rama staging debe mantenerse siempre en estado publicable, lo que justifica los controles de calidad de sec. 8.3.

## 8.3 Integración continua

El flujo de integración se ejecuta en cada *pull request* dirigido a staging o a main y en cada envío (*push*) a cualquier otra rama, y tiene dos etapas (los envíos a staging y main los cubre el flujo de publicación, que repite los mismos controles antes de compilar):

1. Calidad: instalación determinista de dependencias, análisis estático, verificación de tipos y la suite completa de pruebas.
1. Compilación de verificación: exportación del paquete para ambas plataformas, que confirma que el proyecto compila de punta a punta antes de invertir treinta minutos en una compilación real.

Además de los controles habituales, el flujo verifica, antes de compilar, que cada proveedor que ofrece el código tenga la configuración que necesita, un control que surgió de un fallo real que las pruebas unitarias no podían detectar (anexo 13.13.1).

## 8.4 Distribución iOS

La publicación se ejecuta sobre un ejecutor macOS y comprende: verificación de credenciales, controles de calidad, obtención de la clave de la API de App Store Connect, firma manual con certificado y perfil de aprovisionamiento propios, generación del proyecto nativo, compilación, archivado y subida.

Inicialmente el proyecto usó la firma gestionada automáticamente por el servicio de compilación, lo que produjo un defecto difícil de diagnosticar: el archivo se exportaba sin los permisos especiales declarados en el proyecto, de modo que la aplicación compilaba, se subía y se instalaba correctamente, pero la función de unión automática a la red WiFi del dispositivo fallaba en el teléfono con un error interno. Desde entonces la firma se realiza explícitamente con el certificado y el perfil del equipo.

El número de compilación se deriva de una marca temporal, y no de un versionado semántico, porque su única función es ordenar las compilaciones dentro del canal de distribución.

Los perfiles del servicio de compilación en la nube del framework están configurados, pero permanecen deshabilitados: la distribución efectiva se realiza con las herramientas nativas desde el ejecutor de integración continua, sin depender del servicio de compilación en la nube del framework ni consumir su cuota.

## 8.5 Distribución Android

El canal Android vigente es un paquete instalable directamente (.apk), firmado con la clave de subida del proyecto. Cada fusión a staging que toca la aplicación lo produce como artefacto de la compilación, listo para descargar y enviar, y el mismo flujo se puede lanzar a mano desde cualquier rama. Es el equivalente Android del grupo interno de TestFlight. Existe porque el formato que exige la tienda (.aab) no se puede instalar en un teléfono: es un formato de publicación que la tienda reparte por dispositivo.

El flujo hacia Google Play (paquete .aab firmado, publicado al canal de prueba interna o cerrada según la rama) está escrito y configurado, pero apagado mientras la cuenta de la tienda no esté activa; al encenderlo, la prueba interna reemplaza al .apk en los envíos a staging. Una advertencia queda escrita para ese día: un .apk firmado por el equipo y uno instalado desde la tienda tienen firmas distintas, y hay que desinstalar el primero.

Los artefactos se nombran con versión y número de compilación: un nombre genérico no permite distinguir dos compilaciones compartidas en una conversación.

## 8.6 Servicios de nube

### 8.6.1 Función de proxy de visión

Desplegada y activa desde el 2 de septiembre de 2026. Su diseño está descrito en la sec. 7.1.6. Desde el punto de vista del despliegue interesan tres aspectos:

1. La política es que las credenciales de los proveedores vivan en el almacén de secretos del proyecto, y no en el repositorio ni en el paquete de la aplicación; las excepciones históricas se describen en la sec. 8.7.5. Las compilaciones distribuidas sólo necesitan dos valores de configuración, la dirección del proxy y la de telemetría, que son direcciones y no claves. El código admite además una clave anónima pública de Supabase, que por diseño puede viajar en el paquete porque el acceso a los datos queda protegido por las políticas de seguridad a nivel de fila (sec. 8.6.2), y claves directas de proveedor para el desarrollo local sin proxy.
1. Los códigos de error se eligieron para que el cliente pueda reaccionar: 400 ante un destino que no figura en la lista blanca, 405 ante un método incorrecto, 502 si no se alcanza al proveedor, y 503 (y no 500) cuando falta una credencial, porque el servicio se encuentra sin configurar. El mensaje de ese error nombra el proveedor cuya credencial falta, aunque no la credencial en sí; es una limitación conocida, porque revela a cualquier cliente qué proveedores están configurados. El limitador devuelve 429 con el mismo código de error que usan los proveedores, de modo que el cliente ya sabe esperar en lugar de abortar.
1. Limitación conocida: el limitador por dirección de origen mantiene su contador en memoria del proceso, y la plataforma ejecuta varias instancias simultáneas, cada una con su propio contador. En consecuencia, el límite efectivo es mayor que el configurado y el limitador sólo dificulta el abuso, sin impedirlo; la protección de fondo es el tope de gasto de cada proveedor (sec. 6.7).

### 8.6.2 Función de telemetría y base de datos

Recibe lotes de eventos y los inserta en la tabla correspondiente utilizando una credencial de servicio, de modo que la aplicación nunca posee acceso directo a la base. Aplica dos topes: cien eventos por lote y un tamaño máximo por detalle, que al superarse se reemplaza por completo y no parcialmente, porque un detalle sobredimensionado es la señal de que algo no debería estar enviándose por ese canal.

La tabla de eventos tiene seguridad a nivel de fila habilitada y ninguna política definida, a propósito: con la clave pública una consulta devuelve un conjunto vacío. La advertencia quedó escrita en la documentación del backend: si se configura, la clave pública viaja dentro del paquete de la aplicación, de modo que una política de lectura para el rol anónimo es una política para cualquiera que la extraiga.

El esquema se gestiona por migraciones que se agregan y no se editan. La migración que tradujo los nombres al inglés (ADR 0009) renombró en lugar de recrear, para no perder los registros de las primeras sesiones de campo, que son el único diagnóstico disponible de esa etapa.

### 8.6.3 Función de evidencia y su almacenamiento

Desplegada el 12 de octubre de 2026, es la tercera función. Recibe las fotos del modo ómnibus (el cuadro en que se detectó cada ómnibus y cada recorte del cartel que leyó el OCR, sec. 7.6.4) y las guarda en un contenedor de almacenamiento privado, creado por su propia migración. El camino tiene tres pasos: el dispositivo guarda las imágenes y avisa por Bluetooth; la aplicación las baja por WiFi y registra en el momento un evento de telemetría con lo que leyó el OCR y la ruta de cada imagen; las imágenes quedan en cola en el teléfono y se suben cuando hay internet.

Las rutas son deterministas: el evento es correcto aunque la imagen llegue una hora después, y ningún lado tiene que avisarle al otro dónde quedó nada. Como la telemetría, la función no exige sesión (ADR 0008) y aplica topes: cuatro archivos por pedido, 2 MB por archivo y sólo imágenes JPEG, verificadas por sus primeros bytes (docs/supabase.md). Es una herramienta de desarrollo y temporal: son fotos de la calle, con personas, y se retira antes de la versión final.

Esas imágenes (cuadros completos y recortes del cartel) son datos personales en los términos de la Ley 18.331, porque pueden contener personas identificables y matrículas de vehículos \[107\]. Su finalidad es construir el conjunto de evaluación del modo ómnibus y revisar qué vio el sistema en cada anuncio (sec. 7.3.9); se guardan en el almacenamiento privado del proyecto en el servidor, al que sólo accede el equipo, y en el teléfono sólo se muestran en el modo desarrollo (sec. 7.6.4). Su uso se limita al desarrollo: la función debe deshabilitarse y las imágenes almacenadas eliminarse antes de cualquier versión pública.

### 8.6.4 Riesgo operativo declarado

El nivel gratuito de la plataforma pausa los proyectos sin actividad durante una semana, y ya ocurrió una vez. Con el proxy en producción y sin credenciales embebidas en la aplicación, una pausa deja sin modo supermercado a todas las versiones distribuidas simultáneamente. Es una dependencia de disponibilidad que el proyecto asume conscientemente y que debe monitorearse.

## 8.7 Instalación y operación del dispositivo

Instalar software en un dispositivo embebido sin pantalla y sin teclado es un problema distinto de publicar una aplicación móvil, y requirió más esfuerzo del previsto en la planificación. Esta sección describe el procedimiento establecido y las restricciones que lo determinaron.

### 8.7.1 La tarjeta de memoria como panel de control

La tarjeta que corre en el dispositivo tiene una partición de arranque en formato FAT, legible y escribible desde cualquier computadora. El proyecto la usa deliberadamente como superficie de administración: el modo de red, los perfiles de red inalámbrica y los archivos de audio de los avisos de sistema se instalan dejando archivos en esa partición, que un servicio lee en cada arranque.

Esto responde a la restricción de la sec. 7.2.5: un dispositivo en modo producto no tiene acceso remoto por la red conocida, de modo que si la única vía de administración fuera la red, cualquier error de configuración dejaría al dispositivo irrecuperable sin desarmarlo. Desde septiembre existe además la vía por Bluetooth de la anexo 13.13.2, que evita retirar la tarjeta en el caso habitual; la tarjeta sigue siendo el recurso que no depende de que el servicio esté funcionando. La Tabla 33 enumera los archivos de control que admite la partición de arranque.

Tabla 33: Archivos de control en la partición de arranque y su efecto.

| **Se deja en la partición de arranque** | **Efecto en el siguiente arranque** |
|---|---|
| El archivo interruptor de modo de red | Selecciona modo desarrollo o modo producto |
| Un perfil de red inalámbrica | Se instala y queda disponible; el gestor de red conserva todos los perfiles y se une al que esté presente |
| Una carpeta con los audios de avisos de sistema | Se copian al repertorio del dispositivo |

El dispositivo conserva varios perfiles de red simultáneos, uno por cada entorno donde se trabajó. Es la diferencia entre poder llevarlo a probar a otro lugar y tener que reconfigurarlo.

### 8.7.2 Acceso, despliegue y diagnóstico

El dispositivo puede alcanzarse por cuatro vías, de las cuales la principal es una herramienta que apaga su punto de acceso a través de Bluetooth: en unos cinco segundos la placa vuelve a la red conocida y queda accesible sin abrir la carcasa ni retirar la tarjeta. El equipo adoptó una regla después de perder sesiones a mitad de una copia de archivos: no desplegar desde una computadora con una sola interfaz de red, porque al unirse al punto de acceso del dispositivo se queda sin internet y el sistema operativo vuelve por sí solo a la red conocida, cortando la transferencia. El procedimiento de despliegue consta de cinco pasos: llevar el dispositivo a la red conocida, detener el servicio, instalar la versión nueva conservando un respaldo de la anterior, dejar el paquete también en la tarjeta y verificar el estado antes de volver a modo producto. Desde el 23 de septiembre de 2026 el registro del servicio, único diagnóstico del dispositivo en uso, se conserva entre reinicios. El detalle de cada vía, del procedimiento con sus restricciones y del diagnóstico está en el anexo 13.13.

### 8.7.3 El punto de acceso y la conectividad del teléfono

El dispositivo publica una red propia protegida con clave compartida. Una corrección necesaria fue eliminar de su configuración las opciones que anuncian puerta de enlace y servidor de nombres: sin ese ajuste, el teléfono que se unía a la red del dispositivo enrutaba todo su tráfico por ella y quedaba sin acceso a internet, lo que impedía alcanzar la nube en el modo supermercado. La red queda así declarada como de alcance estrictamente local, y el teléfono conserva su conexión de datos.

Ese mismo aislamiento impide que una computadora de una sola interfaz llegue a internet mientras está unida a la red del dispositivo (anexo 13.13.2).

### 8.7.4 El pipeline de visión como dependencia

El pipeline de reconocimiento de líneas se instala en el dispositivo como dependencia desde su propio repositorio, y no se copia dentro del paquete del servicio. Esto mantiene el ciclo de trabajo del pilar de aprendizaje automático (entrenar, evaluar, exportar) independiente del ciclo del dispositivo, y permite actualizar el modelo sin reinstalar el servicio.

### 8.7.5 Deuda operativa declarada

El procedimiento descrito es reproducible pero no está terminado, y las brechas, reunidas en la Tabla 34, se declaran porque condicionan la etapa final.

Tabla 34: Deuda operativa del despliegue al cierre del informe.

| **Pendiente** | **Consecuencia** |
|---|---|
| La tarjeta en uso no se instaló con el script de instalación del repositorio, sino a mano. No existe todavía una imagen reproducible | Reconstruir el dispositivo desde cero no es un procedimiento verificado |
| Las credenciales de administración del dispositivo se compartieron por un canal no seguro durante el desarrollo, y una clave de servicio quedó en el historial de un repositorio. Además, hasta el 23 de noviembre de 2026 el flujo de publicación incorporaba a la compilación una clave de Gemini de nivel gratuito, sin medio de pago asociado, que podía recuperarse de los paquetes ya distribuidos (sec. 7.1.6 y 9.7.5) | La rotación de esas credenciales está pendiente. La clave de Gemini se retiró de los flujos y del repositorio, pero debe rotarse, porque viajó en versiones anteriores. Ambas cosas deben resolverse antes de cualquier distribución más amplia |
| El sistema de aprovisionamiento automático estándar de la imagen no aplica la configuración de red en esta versión | Todo el andamiaje de configuración descrito existe por eso, y debería revisarse si se actualiza la imagen base |

## 8.8 Estado del despliegue

La Tabla 35 resume el estado del despliegue de cada componente al cierre del informe.

Tabla 35: Estado del despliegue de cada componente.

| **Componente** | **Estado** |
|---|---|
| Integración continua | Operativa |
| TestFlight, canal interno y enlace público | Operativo punta a punta |
| Android, paquete .apk desde staging | Operativo |
| Google Play | Configurado y apagado; pendiente de activar la cuenta de la tienda |
| Proxy de visión | Desplegado y activo |
| Telemetría y base de datos | Desplegadas |
| Evidencia del modo ómnibus (función y almacenamiento privado) | Desplegada desde el 12 de octubre de 2026; temporal, se retira antes de la versión final |
| Servicio del dispositivo | Instalado y operativo; la placa se reemplazó el 7 de noviembre de 2026 y funcionó con la misma tarjeta de memoria |
| Imagen de tarjeta reproducible del dispositivo | Parcial: la tarjeta en uso no se instaló con el script |
