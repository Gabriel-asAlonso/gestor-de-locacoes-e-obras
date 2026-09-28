"use client";

import { useEffect } from 'react';
import { reportClientError } from './services/client-observability';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportClientError(error, 'FRONTEND_RENDER_ERROR', { digest: error.digest }), [error]);
  return <main className="global-error" role="alert">
    <div><span>Falha inesperada</span><h1>Não foi possível exibir esta tela.</h1>
      <p>Tente novamente. Se o problema continuar, informe o horário ao suporte.</p>
      <button type="button" onClick={reset}>Tentar novamente</button>
    </div>
  </main>;
}

