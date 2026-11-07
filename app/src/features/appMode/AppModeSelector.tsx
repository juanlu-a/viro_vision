/**
 * Product mode or development mode, in Settings.
 *
 * A dropdown (`DropdownSelect`) since 2026-11-07, by request: the two inline options took the room of
 * two buttons for a switch only the team uses, and the trigger already says which mode is in force
 * ("Modo de la app: Modo producto"), which is what a `Switch` would not ("modo desarrollo,
 * desactivado" does not say which mode is on). The choice is spoken, because nothing else confirms it
 * to someone who does not see Home change.
 */
import { useRef } from 'react';

import { DropdownSelect, type DropdownOption } from '@/components/dropdown-select';
import { announce } from '@/features/audio/announcer';
import { strings } from '@/i18n';
import type { AppMode } from '@/services/storage/appModePreference';

import { useAppMode } from './AppModeProvider';

const t = strings.settings;

/** Long enough for the menu's fade-out (~300 ms) and for the screen reader to land on the trigger. */
const ANNOUNCE_DELAY_MS = 600;

const OPTIONS: readonly DropdownOption<AppMode>[] = [
  { value: 'product', label: t.appModeProduct, hint: t.appModeProductHint },
  { value: 'development', label: t.appModeDevelopment, hint: t.appModeDevelopmentHint },
];

export function AppModeSelector() {
  const { mode, setMode } = useAppMode();
  // Only the last switch is said: two quick switches must not speak a stale mode after the new one.
  const pendingAnnounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const choose = (value: AppMode) => {
    if (value === mode) return;
    setMode(value);
    // `announce` (the phone) and not `notify`: the board has no recorded clip for this phrase, and the
    // person switching modes is the team, phone in hand. Delayed: said while the menu closes, it would
    // talk over the screen reader reading the trigger that focus lands on.
    const phrase = value === 'development' ? t.appModeSetToDevelopment : t.appModeSetToProduct;
    if (pendingAnnounce.current) clearTimeout(pendingAnnounce.current);
    pendingAnnounce.current = setTimeout(() => void announce(phrase), ANNOUNCE_DELAY_MS);
  };

  return (
    <DropdownSelect
      value={mode}
      options={OPTIONS}
      onChange={choose}
      label={t.appMode}
      hint={t.appModeHint}
      menuLabel={t.appModeSelect}
      icon="construct"
    />
  );
}
