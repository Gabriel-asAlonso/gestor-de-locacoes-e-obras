/**
 * Reusable, typed errors. Every module throws one of these instead of composing
 * HTTP status codes and messages by hand. The central error handler turns them
 * into the standardised envelope (see error-handler.ts and the API contract §2.7).
 */
export interface ErrorDetail {
  field?: string;
  rule?: string;
  message: string;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: ErrorDetail[];
  /** true = safe to expose message to the client even in production. */
  readonly expose: boolean;

  constructor(statusCode: number, code: string, message: string, details: ErrorDetail[] = [], expose = true) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.expose = expose;
  }
}

/** 400 — malformed payload/params, wrong types, missing required fields. */
export class ValidationError extends AppError {
  constructor(message = 'Dados inválidos.', details: ErrorDetail[] = []) {
    super(400, 'VALIDACAO', message, details);
  }
}

/** 401 — missing/expired/invalid credentials or token. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Não autenticado.', code = 'NAO_AUTENTICADO') {
    super(401, code, message);
  }
}

/** 403 — authenticated but not allowed (profile/permission). */
export class ForbiddenError extends AppError {
  constructor(message = 'Sem permissão para esta ação.', code = 'SEM_PERMISSAO') {
    super(403, code, message);
  }
}

/** 404 — resource does not exist or is out of scope. */
export class NotFoundError extends AppError {
  constructor(message = 'Registro não encontrado.') {
    super(404, 'NAO_ENCONTRADO', message);
  }
}

/** 409 — duplicate business key / concurrent edit conflict. */
export class ConflictError extends AppError {
  constructor(message = 'Conflito de dados.', details: ErrorDetail[] = []) {
    super(409, 'CONFLITO', message, details);
  }
}

/** 422 — request is well-formed but violates a domain invariant. */
export class BusinessRuleError extends AppError {
  constructor(message = 'Regra de negócio inválida.', details: ErrorDetail[] = []) {
    super(422, 'REGRA_NEGOCIO', message, details);
  }
}

/** 429 — too many requests (rate limiting). */
export class TooManyRequestsError extends AppError {
  constructor(message = 'Muitas tentativas. Tente novamente em instantes.') {
    super(429, 'MUITAS_TENTATIVAS', message);
  }
}

/** 500 — unexpected failure. The real cause stays in the logs, never in the response. */
export class InternalError extends AppError {
  constructor(message = 'Erro interno.') {
    super(500, 'ERRO_INTERNO', message, [], false);
  }
}
