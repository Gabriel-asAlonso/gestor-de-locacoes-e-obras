/**
 * Centralised, validated configuration. No secret has a default value; the app
 * refuses to start when a critical setting is missing (fail-fast, controlled).
 * SQLite is a file, so there is no DB host/port/user/password — only DATABASE_PATH.
 */
import { z } from 'zod';

/** Accepts "900" (seconds) or "15m"/"2h"/"7d"/"30s" and returns seconds. */
function durationToSeconds(raw: string): number | null {
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(trimmed);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2] as 's' | 'm' | 'h' | 'd';
  return value * { s: 1, m: 60, h: 3600, d: 86400 }[unit];
}

const duration = (fallback: string) =>
  z
    .string()
    .default(fallback)
    .transform((value, ctx) => {
      const seconds = durationToSeconds(value);
      if (seconds === null || seconds <= 0) {
        ctx.addIssue({ code: 'custom', message: `Duração inválida: "${value}" (use segundos ou 15m/2h/7d).` });
        return z.NEVER;
      }
      return seconds;
    });

const EnvSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_HOST: z.string().min(1).default('127.0.0.1'),
  APP_PORT: z.coerce.number().int().min(1).max(65535).default(3001),

  // SQLite local: a file path, not a network database. Host/port/user/password do not apply.
  DATABASE_PATH: z.string().min(1).default('./.data/locacoes.sqlite'),
  UPLOADS_PATH: z.string().min(1).default('./.data/uploads'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter ao menos 32 caracteres.'),
  JWT_EXPIRES_IN: duration('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET deve ter ao menos 32 caracteres.'),
  JWT_REFRESH_EXPIRES_IN: duration('7d'),

  CORS_ORIGINS: z.string().default(''),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'critical']).default('info'),

  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(12_000_000),
});

export type AppConfig = Readonly<
  z.infer<typeof EnvSchema> & {
    isProduction: boolean;
    isDevelopment: boolean;
    isTest: boolean;
    corsOrigins: string[];
  }
>;

let cached: AppConfig | null = null;

/** Parses process.env once. Throws a clear aggregated error when configuration is invalid. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => `  - ${issue.path.join('.') || '(env)'}: ${issue.message}`);
    throw new Error(`Configuração inválida. Corrija as variáveis de ambiente:\n${lines.join('\n')}`);
  }
  const data = parsed.data;
  cached = Object.freeze({
    ...data,
    isProduction: data.APP_ENV === 'production',
    isDevelopment: data.APP_ENV === 'development',
    isTest: data.APP_ENV === 'test',
    corsOrigins: data.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  });
  return cached;
}

/** For tests that need to re-read env after mutating process.env. */
export function resetConfigCache(): void {
  cached = null;
}
