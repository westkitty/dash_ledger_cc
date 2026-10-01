import type { OAuthHelpers } from '@cloudflare/workers-oauth-provider';

export interface Env {
  DB: D1Database;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
  AUTH_PEPPER: string;
  BOOTSTRAP_SECRET: string;
  ALLOWED_ORIGINS?: string;
}

export const LIMITS = {
  toolCallsPerUserPerDay: 2_000,
  syncUploadsPerUserPerDay: 100,
  proposalsPerUserPerDay: 1_000,
  snapshotBytes: 2 * 1024 * 1024,
} as const;
