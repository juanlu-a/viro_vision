/**
 * Each platform's NATIVE tab bar.
 *
 * It uses expo-router's `NativeTabs` instead of the JS-drawn bar. On iOS 26 that means a real
 * UITabBar, with Liquid Glass and the system's floating behaviour; on Android, Material's
 * BottomNavigationView. It is not only aesthetics: the native bar inherits the system's
 * accessibility handling for free —focus, VoiceOver rotor, text sizes, Reduce Motion— which in a
 * hand-painted bar has to be reimplemented and maintained.
 *
 * On iOS `backgroundColor` is deliberately NOT set: setting it makes the bar opaque and the Liquid
 * Glass is lost. Only the active item is tinted with the brand colour.
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
      // The bar minimizes on scroll down and comes back on scroll up: it lets the content breathe
      // and it is the gesture iOS 26 expects. No effect on earlier versions.
      minimizeBehavior="onScrollDown"
      // Android has no Liquid Glass: there a solid brand background is worth it so the bar does not
      // float over the content with no separation.
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
