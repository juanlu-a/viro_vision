/**
 * Screen header: brand symbol on the left, title beside it, subtitle underneath.
 *
 * **The symbol appears only on Home.** Repeating it on every screen turned it into decoration: the
 * brand stops saying "this is the app" and becomes noise to skip past. What every screen does have
 * to share is the *structure*, and that is what `minHeight` on the title row takes care of: with or
 * without the symbol, the title always lands at the same height. Without it, the row's height would
 * be decided by its tallest element —the symbol on Home, the line of text elsewhere— and the titles
 * would end up misaligned across screens.
 *
 * There are **two symbol files**, not one recoloured: the brand manual defines the pupil as deep
 * blue on light and white on dark, and a single image cannot do both — with a white pupil on a light
 * background the eye looks hollow.
 *
 * The symbol is decorative for the screen reader — the title already says which screen you are on,
 * and announcing "image" before every header would be noise on every navigation.
 */
import { Image } from 'expo-image';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemePreference } from '@/features/theme/ThemePreferenceProvider';

/** `large` only on Home. Every other screen goes without the mark. */
export type HeaderMark = 'large' | 'none';

const MARK_SIZE = 48;

export function ScreenHeader({
  title,
  subtitle,
  mark = 'none',
}: {
  title: string;
  subtitle?: string;
  mark?: HeaderMark;
}) {
  const { scheme } = useThemePreference();

  return (
    <View className="gap-two">
      {/* `min-h-[48px]`: the fixed height makes the title land at the same height whether it
          carries a symbol or not. Without it, each screen's tallest element would decide. */}
      <View className="min-h-[48px] flex-row items-center gap-three">
        {mark !== 'none' && (
          <Image
            source={
              scheme === 'dark'
                ? require('@/../assets/images/symbol-dark.png')
                : require('@/../assets/images/symbol-light.png')
            }
            style={{ width: MARK_SIZE, height: MARK_SIZE }}
            contentFit="contain"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        )}
        {/* `flex: 1` so the title wraps onto two lines instead of pushing the symbol off screen
            when the user enlarges the system type. */}
        <ThemedText type="title" accessibilityRole="header" className="flex-1">
          {title}
        </ThemedText>
      </View>
      {subtitle ? (
        <ThemedText type="default" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      ) : null}
    </View>
  );
}
