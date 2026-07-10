/**
 * Auth domain model for the online account layer (see ADR 0002).
 *
 * This layer is deliberately isolated from the recognition/device layers: nothing here sits on the
 * essential offline path. A signed-in user stays "signed in" while offline — access is gated on a
 * persisted session, not on a live network call.
 */

/** Minimal user profile surfaced to the UI. */
export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

/** A persisted auth session. Tokens are stored in device secure storage, not in app state. */
export interface AuthSession {
  user: AuthUser;
  /** Epoch millis when the access token expires; refreshed silently when back online. */
  expiresAt: number;
}

export type AuthStatus =
  | 'loading' // restoring a persisted session on startup
  | 'signedOut'
  | 'signedIn'
  | 'error';

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  /** Human-readable message (Spanish, screen-reader friendly). */
  message: string;
}
