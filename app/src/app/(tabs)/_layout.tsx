/**
 * Barra de pestañas NATIVA de cada plataforma.
 *
 * Usa `NativeTabs` de expo-router en vez de la barra dibujada en JS. En iOS 26 eso significa una
 * UITabBar real, con Liquid Glass y el comportamiento flotante del sistema; en Android, la
 * BottomNavigationView de Material. No es sólo estética: la barra nativa hereda gratis el manejo
 * de accesibilidad del sistema —foco, rotor de VoiceOver, tamaños de texto, Reduce Motion— que en
 * una barra pintada a mano hay que reimplementar y mantener.
 *
 * En iOS NO se fija `backgroundColor` a propósito: hacerlo vuelve opaca la barra y se pierde el
 * Liquid Glass. Sólo se tiñe el ítem activo con el color de marca.
 */
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { strings } from '@/i18n';

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <NativeTabs
      tintColor={theme.primary}
      // La barra se minimiza al bajar y vuelve al subir: deja respirar el contenido y es el
      // gesto que iOS 26 espera. Sin efecto en versiones anteriores.
      minimizeBehavior="onScrollDown"
      // Android no tiene Liquid Glass: ahí sí conviene un fondo sólido de marca para que la
      // barra no quede flotando sobre el contenido sin separación.
      {...(Platform.OS === 'android'
        ? { backgroundColor: theme.surface, indicatorColor: theme.primaryMuted }
        : null)}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{strings.tabs.home}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" drawable="ic_menu_home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="connect">
        <NativeTabs.Trigger.Label>{strings.tabs.device}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="dot.radiowaves.left.and.right" drawable="ic_menu_compass" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>{strings.tabs.settings}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape.fill" drawable="ic_menu_manage" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
