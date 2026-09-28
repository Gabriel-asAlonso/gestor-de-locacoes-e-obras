import type { ReactNode } from "react";

interface AuthShellProps {
  children: ReactNode;
  contextDescription: string;
  contextTitle: string;
  panelLabel: string;
  variant?: "login" | "register";
}

export function AuthShell({
  children,
  contextDescription,
  contextTitle,
  panelLabel,
  variant = "login",
}: AuthShellProps) {
  return <main className={`login-page auth-page auth-page-${variant}`}>
    <section className="login-brand" aria-label="Apresentação do sistema">
      <div className="login-brand-header">
        <div className="login-brand-lockup">
          <div className="brand-mark brand-mark-light" aria-hidden="true"><span>L</span><i /><span>R</span></div>
          <div><strong>Locações &amp; Recebíveis</strong><span>Gestão patrimonial</span></div>
        </div>
        <span className="login-module-badge">Módulo 1</span>
      </div>

      <div className="login-copy">
        <p className="eyebrow eyebrow-light">Gestão imobiliária integrada</p>
        <h1>Patrimônio sob controle.<span>Recebíveis em movimento.</span></h1>
        <p>Uma visão única para acompanhar estruturas, contratos e a saúde financeira da operação.</p>
        <ul className="login-capabilities" aria-label="Áreas do sistema">
          <li><span>01</span><strong>Patrimônio</strong><small>Carteiras, imóveis e unidades</small></li>
          <li><span>02</span><strong>Contratos</strong><small>Locatários e vínculos ativos</small></li>
          <li><span>03</span><strong>Financeiro</strong><small>Cobranças e despesas</small></li>
        </ul>
      </div>

      <div className="login-brand-footer">
        <div className="login-footer"><span /> Operação integrada</div>
        <div className="login-property-caption"><strong>Centro Empresarial Nexo</strong><span>Patrimônio em destaque</span></div>
      </div>
    </section>

    <section className="login-panel" aria-label={panelLabel}>
      <div className="login-panel-inner">
        <div className="login-panel-context">
          <span>LR</span>
          <p><strong>{contextTitle}</strong><small>{contextDescription}</small></p>
        </div>
        {children}
        <p className="login-panel-version">Locações &amp; Recebíveis · Gestão operacional</p>
      </div>
    </section>
  </main>;
}
