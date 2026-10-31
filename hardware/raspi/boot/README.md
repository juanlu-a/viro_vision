# `boot/`: lo que vive en la partición FAT de la microSD

Estos archivos **no los usa el repo**: son copias versionadas de lo que corre desde
`/boot/firmware/` en la placa. Se ponen acá porque hasta el 2026-09-17 existían en **un solo lugar
del mundo**, la microSD de la Pi, que es un medio que se corrompe, se reformatea y se presta.

`modo-red.sh` decide en cada arranque si la placa levanta su AP o se queda en la WiFi conocida. Si
se pierde, se pierde la única forma de entrar a una placa en modo producto sin abrir la caja.

| archivo | quién lo corre | qué hace |
|---|---|---|
| `modo-red.sh` | `virovision-modo-red.service`, cada arranque | modo de red según exista `SIN-AP`; instala perfiles `*.nmconnection` y los avisos de sistema dejados en la tarjeta (y retira los que la tarjeta ya no trae). Sólo trabaja si algo cambió: ver abajo |
| `instalar-daemon.sh` | `virovision-instalar.service`, etapa 2 | extrae `virovision-daemon.tgz` y corre `setup.sh`. **Protegido por la centinela `/var/lib/virovision-instalado`**: una vez instalado no se vuelve a ejecutar, así que un daemon nuevo se despliega por SSH |

## `modo-red.sh` está en la cadena crítica del arranque

`virovision.service` arranca después de él, y la placa no anuncia por BLE hasta que el daemon arranca.
Hasta el 2026-10-06 costaba **3,5 s en cada arranque**, 2,4 de ellos en un `systemctl daemon-reload`
que casi nunca hacía falta. Desde entonces (#111; `docs/SESSION-LOG.md`, 2026-10-06 cont. 3) cada paso
compara con `cmp -s` antes de tocar nada:

- el drop-in `10-sin-ap.conf` se escribe en un temporal y sólo se instala si difiere del que está; se
  borra sólo si existe;
- `daemon-reload` corre **sólo si el drop-in cambió** (`RELOAD_UNITS=1`), es decir, al pasar de
  producto a desarrollo o al revés;
- los perfiles `*.nmconnection` y los `.wav` de `announcements-system/` se instalan sólo si difieren, y
  `nmcli connection reload` corre sólo si entró un perfil nuevo.

Resultado medido en la placa: **0,27 s** sin cambios, ~2,2 s al cambiar de modo, probado en los dos
sentidos. Si se agrega un paso al script, tiene que seguir la misma regla.

El drop-in que escribe lee las banderas de `/etc/default/virovision` (`EnvironmentFile` y
`$VIROVISION_ARGS`), igual que la unidad base: así el detector elegido sobrevive al cambio de modo.

## Cómo se actualizan

Se editan **acá**, se copian a la tarjeta (o a `/boot/firmware/` por SSH) y se reinicia. No al revés:
editar sólo en la tarjeta es exactamente lo que dejó a estos dos archivos fuera de git durante un mes.

```sh
scp hardware/raspi/boot/modo-red.sh virovision@virovision.local:/tmp/
ssh virovision@virovision.local 'sudo install -m 755 /tmp/modo-red.sh /boot/firmware/modo-red.sh'
```

## Una trampa medida

`modo-red.sh` corre **antes de que NTP sincronice**, y la Pi no tiene RTC: toma la hora que systemd
guardó al apagarse. Todo lo que instala queda con la fecha del apagado anterior, no la de hoy. El
2026-09-17 eso hizo pensar que los avisos de sistema eran de un despliegue viejo cuando se acababan
de copiar. Para saber cuándo se instaló algo, mirar
`/var/log/virovision-firstrun.log`, no la fecha del archivo.
