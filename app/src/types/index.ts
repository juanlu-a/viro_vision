/**
 * Public re-exports of the app's core domain types, for convenient importing from `@/types`.
 * The source of truth lives in each feature folder.
 */
export type { ConnectionState, ConnectionStatus, DeviceInfo } from '@/features/device/types';
export type {
  Detection,
  RecognitionEvent,
  RecognitionKind,
} from '@/features/recognition/types';
