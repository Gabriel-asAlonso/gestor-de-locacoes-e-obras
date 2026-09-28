export type UserStatus = 'pendente' | 'ativo' | 'rejeitado' | 'inativo';
export interface SessionUser { id: string; nome: string; email: string; perfilCodigo: string | null; status: UserStatus; ativo: boolean }
export interface SessionInfo { usuario: SessionUser; permissoes: string[] }
export interface SessionTokens extends SessionInfo { token: string; refreshToken: string; expiresAt: string }
export interface RegistrationInput { nome: string; email: string; senha: string }
export interface RegistrationResult { id: string; nome: string; email: string; status: 'pendente'; createdAt: string }
export interface ApiErrorDetail { field?: string; rule?: string; message: string }

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];
  readonly requestId?: string;
  constructor(message: string, status = 0, code = 'CONEXAO', details: ApiErrorDetail[] = [], requestId?: string) {
    const reference = requestId && status >= 500 ? requestId.slice(0, 8).toUpperCase() : '';
    super(reference ? `${message} Código da ocorrência: ${reference}.` : message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

const newRequestId = () => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const REFRESH_STORAGE_KEY = 'locacoes.auth.refresh.v1';
type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
interface ClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  storage?: () => SessionStorage | null;
  timeoutMs?: number;
}
const sessionExpired = () => new ApiError('Sessão expirada. Entre novamente.', 401, 'NAO_AUTENTICADO');
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function validateSession(value: unknown): SessionTokens {
  if (!isObject(value) || typeof value.token !== 'string' || !value.token || typeof value.refreshToken !== 'string'
    || !value.refreshToken || typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt))
    || !isObject(value.usuario) || typeof value.usuario.id !== 'string' || typeof value.usuario.nome !== 'string'
    || typeof value.usuario.email !== 'string' || value.usuario.status !== 'ativo' || value.usuario.ativo !== true
    || !Array.isArray(value.permissoes) || !value.permissoes.every(p => typeof p === 'string')) {
    throw new ApiError('Resposta inválida da API. Tente novamente.', 502, 'RESPOSTA_INVALIDA');
  }
  return value as unknown as SessionTokens;
}

/** Central transport: no component handles tokens, refresh, retry or HTTP errors. */
export class ApiClient {
  private readonly options: ClientOptions;
  private session: SessionTokens | null = null;
  private generation = 0;
  private refreshFlight: Promise<SessionTokens> | null = null;
  private loggingOut = false;
  private readonly listeners = new Set<(session: SessionInfo | null) => void>();

  constructor(options: ClientOptions) { this.options = options; }

  subscribe(listener: (session: SessionInfo | null) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private storage() {
    try { return this.options.storage?.() ?? null; } catch { return null; }
  }

  private persistedRefresh() {
    try { return this.storage()?.getItem(REFRESH_STORAGE_KEY) ?? null; } catch { return null; }
  }

  private publish(session: SessionTokens | null) {
    this.session = session;
    try {
      const storage = this.storage();
      if (session) storage?.setItem(REFRESH_STORAGE_KEY, session.refreshToken);
      else storage?.removeItem(REFRESH_STORAGE_KEY);
    } catch { /* Disabled browser storage: the in-memory session still works until reload. */ }
    const info = session ? { usuario: session.usuario, permissoes: session.permissoes } : null;
    for (const listener of this.listeners) listener(info);
  }

  private clear() { this.generation++; this.publish(null); }

  private async send<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('A API exige um caminho relativo.');
    const headers = new Headers(init.headers);
    const requestId = headers.get('X-Request-Id') ?? newRequestId();
    headers.set('X-Request-Id', requestId);
    headers.set('Accept', 'application/json');
    if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    else headers.delete('Authorization');
    const timeout = AbortSignal.timeout(this.options.timeoutMs ?? 15000);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    let response: Response;
    try {
      response = await (this.options.fetch ?? fetch)(`${this.options.baseUrl.replace(/\/$/, '')}${path}`, {
        ...init, headers, signal, cache: 'no-store', credentials: 'omit', redirect: 'error',
      });
    } catch {
      if (init.signal?.aborted) throw new ApiError('Consulta cancelada.', 0, 'CANCELADA');
      throw new ApiError(timeout.aborted ? 'A API demorou a responder. Tente novamente.' : 'Não foi possível conectar à API. Verifique a conexão e tente novamente.', 0, timeout.aborted ? 'REQUEST_TIMEOUT' : 'CONEXAO', [], requestId);
    }
    const responseRequestId = response.headers.get('X-Request-Id') ?? requestId;
    const body: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined);
    if (!response.ok) {
      // Never render HTML, stack traces, SQL errors or an upstream 5xx body.
      const error = isObject(body) && isObject(body.error) ? body.error : null;
      const message = response.status >= 500 ? 'Serviço indisponível. Tente novamente.'
        : typeof error?.message === 'string' ? error.message : `Não foi possível concluir a solicitação (${response.status}).`;
      const details = Array.isArray(error?.details) ? error.details.filter((d): d is ApiErrorDetail => isObject(d) && typeof d.message === 'string') : [];
      const bodyRequestId = isObject(body) && typeof body.requestId === 'string' ? body.requestId : responseRequestId;
      throw new ApiError(message, response.status, typeof error?.code === 'string' ? error.code : 'ERRO_HTTP', response.status >= 500 ? [] : details, bodyRequestId);
    }
    if (body === undefined && response.status !== 204) throw new ApiError('Resposta inválida da API. Tente novamente.', 502, 'RESPOSTA_INVALIDA', [], responseRequestId);
    return body as T;
  }

  private async sendBlob(path: string, init: RequestInit, accessToken: string): Promise<Blob> {
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('A API exige um caminho relativo.');
    const headers = new Headers(init.headers);
    const requestId = headers.get('X-Request-Id') ?? newRequestId();
    headers.set('X-Request-Id', requestId);
    headers.set('Accept', '*/*');
    headers.set('Authorization', `Bearer ${accessToken}`);
    const timeout = AbortSignal.timeout(this.options.timeoutMs ?? 15000);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    let response: Response;
    try {
      response = await (this.options.fetch ?? fetch)(`${this.options.baseUrl.replace(/\/$/, '')}${path}`, {
        ...init, headers, signal, cache: 'no-store', credentials: 'omit', redirect: 'error',
      });
    } catch {
      throw new ApiError(timeout.aborted ? 'A API demorou a responder. Tente novamente.' : 'Não foi possível conectar à API.', 0, timeout.aborted ? 'REQUEST_TIMEOUT' : 'CONEXAO', [], requestId);
    }
    if (!response.ok) {
      const body: unknown = await response.clone().json().catch(() => undefined);
      const error = isObject(body) && isObject(body.error) ? body.error : null;
      const bodyRequestId = isObject(body) && typeof body.requestId === 'string' ? body.requestId : response.headers.get('X-Request-Id') ?? requestId;
      throw new ApiError(response.status >= 500 ? 'Serviço indisponível. Tente novamente.' : typeof error?.message === 'string' ? error.message : `Não foi possível carregar o arquivo (${response.status}).`, response.status, typeof error?.code === 'string' ? error.code : 'ERRO_HTTP', [], bodyRequestId);
    }
    return response.blob();
  }

  async login(email: string, senha: string): Promise<SessionInfo> {
    if (this.loggingOut) throw sessionExpired();
    const generation = ++this.generation;
    this.publish(null);
    const session = validateSession(await this.send('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) }));
    if (generation !== this.generation) throw sessionExpired();
    this.publish(session);
    return { usuario: session.usuario, permissoes: session.permissoes };
  }

  async register(input: RegistrationInput): Promise<RegistrationResult> {
    const value = await this.send<unknown>('/auth/register', { method: 'POST', body: JSON.stringify(input) });
    if (!isObject(value) || typeof value.id !== 'string' || typeof value.nome !== 'string'
      || typeof value.email !== 'string' || value.status !== 'pendente'
      || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) {
      throw new ApiError('Resposta inválida da API. Tente novamente.', 502, 'RESPOSTA_INVALIDA');
    }
    return value as unknown as RegistrationResult;
  }

  private refresh(): Promise<SessionTokens> {
    if (this.refreshFlight) return this.refreshFlight;
    const refreshToken = this.session?.refreshToken ?? this.persistedRefresh();
    if (!refreshToken) return Promise.reject(sessionExpired());
    const generation = this.generation;
    const flight = this.send('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) })
      .then(value => {
        const session = validateSession(value);
        if (generation !== this.generation) throw sessionExpired();
        this.publish(session);
        return session;
      })
      .catch(error => {
        if (generation === this.generation && error instanceof ApiError && [401, 403].includes(error.status)) this.clear();
        throw error;
      })
      .finally(() => { if (this.refreshFlight === flight) this.refreshFlight = null; });
    this.refreshFlight = flight;
    return flight;
  }

  async restore(): Promise<SessionInfo | null> {
    if (!this.session && !this.persistedRefresh()) return null;
    if (!this.session) await this.refresh();
    try {
      const info = await this.request<SessionInfo>('/auth/me');
      if (!this.session) throw sessionExpired();
      this.publish(validateSession({ ...this.session, ...info }));
      return info;
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) this.clear();
      throw error;
    }
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (this.loggingOut) throw sessionExpired();
    const session = !this.session || Date.parse(this.session.expiresAt) <= Date.now() + 5000 ? await this.refresh() : this.session;
    const generation = this.generation;
    try {
      const result = await this.send<T>(path, init, session.token);
      if (generation !== this.generation || this.loggingOut) throw sessionExpired();
      return result;
    }
    catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      if (generation !== this.generation || this.loggingOut) throw sessionExpired();
      // A parallel request may already have refreshed the token; never rotate twice for that 401.
      const renewed = this.session && this.session.token !== session.token ? this.session : await this.refresh();
      try {
        const result = await this.send<T>(path, init, renewed.token);
        if (generation !== this.generation || this.loggingOut) throw sessionExpired();
        return result;
      }
      catch (retryError) {
        if (retryError instanceof ApiError && retryError.status === 401 && generation === this.generation) this.clear();
        throw retryError;
      }
    }
  }


  async requestBlob(path: string, init: RequestInit = {}): Promise<Blob> {
    if (this.loggingOut) throw sessionExpired();
    const session = !this.session || Date.parse(this.session.expiresAt) <= Date.now() + 5000 ? await this.refresh() : this.session;
    const generation = this.generation;
    try {
      const result = await this.sendBlob(path, init, session.token);
      if (generation !== this.generation || this.loggingOut) throw sessionExpired();
      return result;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      if (generation !== this.generation || this.loggingOut) throw sessionExpired();
      const renewed = this.session && this.session.token !== session.token ? this.session : await this.refresh();
      return this.sendBlob(path, init, renewed.token);
    }
  }

  async logout(): Promise<void> {
    if (this.loggingOut) return;
    this.loggingOut = true;
    try {
      // Wait for rotation so logout revokes the newest refresh token, not its predecessor.
      if (this.refreshFlight) await this.refreshFlight;
      let session = this.session;
      if (session && Date.parse(session.expiresAt) <= Date.now() + 5000) session = await this.refresh();
      if (session) {
        try { await this.send('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: session.refreshToken }) }, session.token); }
        catch (error) {
          if (!(error instanceof ApiError) || error.status !== 401) throw error;
          session = await this.refresh();
          await this.send('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: session.refreshToken }) }, session.token);
        }
      }
    } finally { this.clear(); this.loggingOut = false; }
  }

  async reportClientError(input: { eventCode: string; message: string; stack?: string; componentStack?: string; route?: string; metadata?: Record<string, unknown> }): Promise<void> {
    if (!this.session || this.loggingOut) return;
    await this.request('/logs/client-errors', { method: 'POST', body: JSON.stringify(input) });
  }
}
