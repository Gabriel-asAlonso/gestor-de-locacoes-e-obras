import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  method: string;
  path: string;
  origin: 'api';
  startedAt: number;
  userId?: string;
  clientAddress?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const runWithRequestContext = <T>(context: RequestContext, callback: () => T): T => storage.run(context, callback);
export const requestContext = (): RequestContext | undefined => storage.getStore();

export function enrichRequestContext(fields: Partial<Pick<RequestContext, 'userId'>>): void {
  const current = storage.getStore();
  if (current) Object.assign(current, fields);
}

