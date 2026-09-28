"use client";

import { useEffect } from 'react';
import { reportClientError } from '../services/client-observability';

export function ClientObservability() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => reportClientError(event.error ?? event.message, 'FRONTEND_WINDOW_ERROR', {
      filename: event.filename, line: event.lineno, column: event.colno,
    });
    const onRejection = (event: PromiseRejectionEvent) => reportClientError(event.reason, 'FRONTEND_UNHANDLED_REJECTION');
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); };
  }, []);
  return null;
}

