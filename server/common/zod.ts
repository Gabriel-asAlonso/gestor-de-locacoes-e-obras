/** Maps Zod issues to the API's error `details` shape. */
import type { ZodError } from 'zod';
import type { ErrorDetail } from './errors.ts';

export function zodIssuesToDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join('.') || undefined,
    rule: issue.code,
    message: issue.message,
  }));
}
