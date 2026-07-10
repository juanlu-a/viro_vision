import { StyleSheet, View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/useAuth';
import { strings } from '@/i18n';

export default function SettingsScreen() {
  const t = strings.settings;
  const { state, signInWithGoogle, signOut } = useAuth();
  const isSignedIn = state.status === 'signedIn';

  return (
    <Screen>
      <View accessible accessibilityRole="text">
        <ThemedText type="default" themeColor="textSecondary">
          {t.intro}
        </ThemedText>
      </View>

      {/* Account (online layer, ADR 0002). Status is a live region for the screen reader. */}
      <View
        accessible
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${strings.settings.account}: ${state.message}`}>
        <ThemedText type="small" themeColor="textSecondary">
          {strings.settings.account}
        </ThemedText>
        <ThemedText type="subtitle">{state.message}</ThemedText>
      </View>

      <View style={styles.actions}>
        {isSignedIn ? (
          <AccessibleButton
            label={strings.auth.signOut}
            hint={strings.auth.signOutHint}
            variant="secondary"
            onPress={signOut}
          />
        ) : (
          <AccessibleButton
            label={strings.auth.signInWithGoogle}
            hint={strings.auth.signInHint}
            disabled={state.status === 'loading'}
            onPress={signInWithGoogle}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: Spacing.three,
  },
});
