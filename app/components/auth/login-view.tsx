"use client";

import { ArrowRight, Check } from "lucide-react";
import type { LoginProps } from "../../session-gate";
import { AuthShell } from "./auth-shell";

export function LoginView({ loading, error, onSubmit }: LoginProps) {
  return <AuthShell
    contextDescription="Patrimônio, contratos e financeiro"
    contextTitle="Módulo administrativo"
    panelLabel="Acesso administrativo"
  >
    <form className="login-form" onSubmit={onSubmit}>
      <div className="login-heading">
        <p className="eyebrow">Acesso administrativo</p>
        <h2>Boas-vindas</h2>
        <p>Entre para visualizar a operação patrimonial e financeira em um único painel.</p>
      </div>
      {error && <p className="login-api-error" role="alert">{error}</p>}
      <label htmlFor="login-email">E-mail<input id="login-email" name="email" type="email" maxLength={254} autoComplete="username" disabled={loading} required /></label>
      <label htmlFor="login-password">Senha<input id="login-password" name="senha" type="password" maxLength={200} autoComplete="current-password" disabled={loading} required /></label>
      <button className="primary-button login-button" disabled={loading} aria-busy={loading}>
        {loading
          ? <><span className="spinner" aria-hidden="true" /> Verificando acesso</>
          : <><span>Acessar painel</span><span className="login-button-arrow" aria-hidden="true"><ArrowRight /></span></>}
      </button>
      <p className="auth-account-switch">Ainda não tem acesso? <a href="/criar-conta">Criar conta</a></p>
      <div className="login-trust-note">
        <span aria-hidden="true"><Check /></span>
        <p><strong>Acesso autenticado pela API</strong><small>Use um usuário ativo cadastrado no sistema. Os módulos ainda em migração são identificados como demonstrativos.</small></p>
      </div>
    </form>
  </AuthShell>;
}
