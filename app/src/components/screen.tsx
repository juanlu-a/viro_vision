/**
 * The standard screen container: theme background, safe area, centred maximum width, consistent
 * spacing, an optional scroll mode and optional pull-to-refresh.
 *
 * **On iOS the insets are handled by UIKit** (`contentInsetAdjustmentBehavior="automatic"`), not by
 * `SafeAreaView`. It is the only way for the content to end up ABOVE iOS 26's floating tab bar: the
 * bar is not part of the classic safe area, but it is part of the `adjustedContentInset` UIKit
 * computes per scroll view. With the previous manual handling, the bottom of the screen ended up
 * hidden behind the bar.
 *
 * That is why on iOS `SafeAreaView` does not apply the top edge in scroll mode: UIKit applies it,
 * and applying it twice was the jumping-scroll bug. On Android (where `automatic` does not exist and
 * the tab bar does not float over the content) the classic safe area is kept.
 */
import { useCallback, useState } from 'react';
import { Platform, RefreshControl, ScrollView, View } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: readonly Edge[];
  /**
   * Pull down to refresh. It only makes sense with `scroll`; the spinner keeps spinning until the
   * promise resolves.
   */
  onRefresh?: () => Promise<void>;
};

/** The content block: maximum width, centred, with the app's padding and rhythm. */
const CONTENT = 'w-full max-w-content self-center gap-four p-four';

export function Screen({ children, scroll = false, edges, onRefresh }: ScreenProps) {
  const theme = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  // On iOS with scroll, UIKit supplies the top inset; in every other case, SafeAreaView.
  const resolvedEdges = edges ?? (scroll && Platform.OS === 'ios' ? [] : ['top']);

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={resolvedEdges}>
        {scroll ? (
          <ScrollView
            // No `justify-center`: it vertically centred short content and the title of a
            // scrolling screen fell lower than that of a non-scrolling one.
            contentContainerClassName="grow"
            // No scroll bar: on a phone the gesture already gives the position, and here it showed
            // up over the cards' edge every time someone swiped. No information is lost: no screen
            // communicates anything through the scroll length.
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentInsetAdjustmentBehavior="automatic"
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={refresh}
                  // The spinner inherits the accent so it shows on both themes.
                  tintColor={theme.primary}
                  colors={[theme.primary]}
                />
              ) : undefined
            }>
            <View className={CONTENT}>{children}</View>
          </ScrollView>
        ) : (
          <View className={`flex-1 ${CONTENT}`}>{children}</View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
