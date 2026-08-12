/**
 * Texto de la app, con la tipografía de la marca (manual, sección 04).
 *
 * Cada estilo fija `fontFamily` y **no** `fontWeight`: los pesos son archivos distintos y pedir
 * además un peso al sistema produce negrita sintética en Android. El peso se elige cambiando de
 * familia (`Fonts.sans` ↔ `Fonts.sansBold`).
 *
 * El manual pide **17 px como mínimo** para texto, y acá se respeta incluso en los rótulos
 * chicos: el piso de tamaño es lo que más se nota en baja visión.
 */
import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontFamily: Fonts.sans,
    fontSize: 17,
    lineHeight: 24,
  },
  smallBold: {
    fontFamily: Fonts.sansBold,
    fontSize: 17,
    lineHeight: 24,
  },
  default: {
    fontFamily: Fonts.sans,
    fontSize: 18,
    lineHeight: 27,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 40,
    lineHeight: 46,
    // Tracking −2 % del manual: Space Grotesk Bold en tamaños grandes se abre demasiado.
    letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: Fonts.display,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.56,
  },
  link: {
    fontFamily: Fonts.sans,
    fontSize: 17,
    lineHeight: 28,
  },
  linkPrimary: {
    fontFamily: Fonts.sansBold,
    fontSize: 17,
    lineHeight: 28,
  },
  code: {
    fontFamily: Fonts.mono,
    fontSize: 15,
    lineHeight: 22,
  },
});
