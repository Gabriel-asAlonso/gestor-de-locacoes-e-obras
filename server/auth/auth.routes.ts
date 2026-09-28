/** Authentication routes, including the public pending-registration endpoint. */
import { Hono } from 'hono';
import type { AppEnv } from '../common/types.ts';
import { readJson } from '../common/validation.ts';
import { created, ok } from '../common/http.ts';
import { authRateLimit } from '../common/security.ts';
import { loginSchema, refreshSchema, logoutSchema, registrationSchema } from './dto.ts';
import { login, logout, refresh, sessionInfo } from './auth.service.ts';
import { requireAuth } from './auth.middleware.ts';
import { requestRegistration } from '../users/registration.service.ts';

export const authRoutes = new Hono<AppEnv>();

authRoutes.post('/register', authRateLimit(), async (c) => {
  const dto = await readJson(c, registrationSchema);
  return created(c, await requestRegistration(dto));
});

authRoutes.post('/login', authRateLimit(), async (c) => {
  const dto = await readJson(c, loginSchema);
  return ok(c, await login(dto.email, dto.senha));
});

authRoutes.post('/refresh', authRateLimit(), async (c) => {
  const dto = await readJson(c, refreshSchema);
  return ok(c, await refresh(dto.refreshToken));
});

authRoutes.post('/logout', requireAuth, async (c) => {
  const dto = c.req.raw.body ? await readJson(c, logoutSchema) : {};
  await logout(c.get('auth'), dto.refreshToken);
  return ok(c, { revoked: true });
});

authRoutes.get('/me', requireAuth, (c) => ok(c, sessionInfo(c.get('user'), c.get('permissions'))));
