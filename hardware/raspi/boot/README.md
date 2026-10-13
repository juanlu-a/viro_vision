# `boot/` — lo que vive en la partición FAT de la microSD

Estos archivos **no los usa el repo**: son copias versionadas de lo que corre desde
`/boot/firmware/` en la placa. Se ponen acá porque hasta el 2026-09-17 existían en **un solo lugar
del mundo**, la microSD de la Pi, que es un medio que se corrompe, se reformatea y se presta.

`modo-red.sh` decide en cada arranque si la placa levanta su AP o se queda en la WiFi conocida. Si
se pierde, se pierde la única forma de entrar a una placa en modo producto sin abrir la caja.

| archivo | quién lo corre | qué hace |
|---|---|---|
| `modo-red.sh` | `virovision-modo-red.service`, cada arranque | modo de red según exista `SIN-AP`; instala perfiles `*.nmconnection` y los avisos de sistema dejados en la tarjeta |
| `instalar-daemon.sh` | `virovision-instalar.service`, etapa 2 | extrae `virovision-daemon.tgz` y corre `setup.sh`. **Protegido por la centinela `/var/lib/virovision-instalado`**: una vez instalado no se vuelve a ejecutar, así que un daemon nuevo se despliega por SSH |

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
