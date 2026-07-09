/**
 * Minimal i18n entry point. Only Spanish exists today; this indirection keeps every
 * component importing from one place so adding a locale later is a single change here.
 */
import { es } from './es';

export const strings = es;
export type { Strings } from './es';
