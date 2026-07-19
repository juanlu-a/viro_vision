import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { A11y, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { strings } from '@/i18n';

export default function SettingsScreen() {
  const t = strings.settings;
  const theme = useTheme();
  const { state, signIn, signUp, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isSignedIn = state.status === 'signedIn';
  const isBusy = state.status === 'loading';
  const canSubmit = email.trim().length > 0 && password.length > 0 && !isBusy;

  const inputStyle = [
    styles.input,
    { color: theme.text, borderColor: theme.textSecondary, backgroundColor: theme.backgroundElement },
  ];

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

      {isSignedIn ? (
        <View style={styles.actions}>
          <AccessibleButton
            label={strings.auth.signOut}
            hint={strings.auth.signOutHint}
            variant="secondary"
            onPress={signOut}
          />
        </View>
      ) : (
        <View style={styles.form}>
          <TextInput
            style={inputStyle}
            value={email}
            onChangeText={setEmail}
            placeholder={strings.auth.emailLabel}
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={strings.auth.emailLabel}
            accessibilityHint={strings.auth.emailHint}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            editable={!isBusy}
          />
          <TextInput
            style={inputStyle}
            value={password}
            onChangeText={setPassword}
            placeholder={strings.auth.passwordLabel}
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={strings.auth.passwordLabel}
            accessibilityHint={strings.auth.passwordHint}
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
            editable={!isBusy}
          />
          <View style={styles.actions}>
            <AccessibleButton
              label={strings.auth.signIn}
              hint={strings.auth.signInHint}
              disabled={!canSubmit}
              onPress={() => signIn(email.trim(), password)}
            />
            <AccessibleButton
              label={strings.auth.signUp}
              hint={strings.auth.signUpHint}
              variant="secondary"
              disabled={!canSubmit}
              onPress={() => signUp(email.trim(), password)}
            />
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
  actions: {
    gap: Spacing.three,
  },
  input: {
    minHeight: A11y.minTouchTarget,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
});
