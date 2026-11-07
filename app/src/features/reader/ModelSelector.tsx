/**
 * Selector of the cloud model for supermarket mode, on the shared `DropdownSelect` (a one-line
 * trigger whose label says which model is in force, and a modal `radiogroup`).
 *
 * It is **controlled by props**: it knows nothing about storage or where the models come from, so
 * what decides (ProductModelProvider and its resolver) is tested without UI.
 */
import { DropdownSelect } from '@/components/dropdown-select';
import { strings } from '@/i18n';
import { getProvider } from '@/services/vision';
import type { ModelProfile } from '@/services/vision';

const t = strings.reader;

type Props = {
  value: ModelProfile;
  options: readonly ModelProfile[];
  onChange: (id: string) => void;
  disabled?: boolean;
};

export function ModelSelector({ value, options, onChange, disabled = false }: Props) {
  return (
    <DropdownSelect
      value={value.id}
      options={options.map((option) => ({
        value: option.id,
        label: option.label,
        hint: `${t.modelProvider}: ${getProvider(option.provider).label}`,
      }))}
      onChange={onChange}
      label={t.modelLabel}
      hint={t.modelHint}
      menuLabel={t.modelSelect}
      icon="cloud"
      disabled={disabled}
    />
  );
}
