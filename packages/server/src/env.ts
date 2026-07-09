/**
 * Environment config (OPERATIONS.md §2). Parsed once via zod; missing/invalid
 * values fail fast at boot rather than mid-request.
 */

import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgres')),
  SESSION_SECRET: z.string().min(16),
  PUBLIC_ORIGIN: z.string().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'silent']).default('info'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  HONOR_SEASON: z.coerce.number().int().min(1).default(1),
  /** Comma-separated IP allowlist for /api/admin (OPERATIONS §6). Empty = allow any IP
   *  (dev); production sets the operator's IPs so the admin surface needs flag AND IP. */
  ADMIN_IP_ALLOWLIST: z.string().default(''),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
