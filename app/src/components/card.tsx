/**
 * A surface container: it groups related content.
 *
 * Written with Tailwind classes (via NativeWind). The names are **semantic**: `bg-surface`, not
 * `bg-blue-900`. A role survives a rebrand; a colour does not.
 *
 * No `dark:` needed: each role is a CSS variable and what changes between themes is its value, not
 * the class. The hex values come from `constants/colors.js`, the same table `theme.test.ts` checks.
 */
import { View, type ViewProps } from 'react-native';

export function Card({ className, ...rest }: ViewProps & { className?: string }) {
  return (
    <View
      {...rest}
      className={`gap-three rounded-lg border border-border bg-surface p-four ${className ?? ''}`}
    />
  );
}
