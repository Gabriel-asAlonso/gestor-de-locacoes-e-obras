"use client";

import { ArrowLeft, ArrowRight, Check, Clock3 } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { ApiError, type RegistrationResult } from "../../services/api-client";
import { PasswordField } from "./password-field";
import {
  validateRegistration,
  type RegistrationErrors,
  type RegistrationField,
  type RegistrationValues,
} from "./registration-validation";

export type { RegistrationValues } from "./registration-validation";

interface RegistrationFormProps {
  onRegister: (values: RegistrationValues) => Promise<RegistrationResult>;
}

const EMPTY_VALUES: RegistrationValues = { nome: "", email: "", senha: "", confirmarSenha: "" };

export function RegistrationForm({ onRegister }: RegistrationFormProps) {
  const [values, setValues] = useState(EMPTY_VALUES);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [registration, setRegistration] = useState<RegistrationResult | null>(null);
  const [revealPassword, setRevealPassword] = useState(false);
  const [revealConfirmation, setRevealConfirmation] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const update = (field: RegistrationField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => current[field] ? { ...current, [field]: undefined } : current);
    setSubmitError("");
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const nextErrors = validateRegistration(values);
    setErrors(nextErrors);
    const firstInvalid = (Object.keys(nextErrors) as RegistrationField[])[0];
    if (firstInvalid) {
      window.requestAnimationFrame(() => formRef.current?.elements.namedItem(firstInvalid) instanceof HTMLElement
        && (formRef.current.elements.namedItem(firstInvalid) as HTMLElement).focus());
      return;
    }

    setSubmitError("");
    setLoading(true);
    try {
      const result = await onRegister({ ...values, nome: values.nome.trim(), email: values.email.trim().toLowerCase() });
      setValues((current) => ({ ...current, senha: "", confirmarSenha: "" }));
      setRegistration(result);
    } catch (error) {
      if (error instanceof ApiError) {
        const serverErrors: RegistrationErrors = {};
        for (const detail of error.details) {
          if (detail.field === "nome" || detail.field === "email" || detail.field === "senha") {
            serverErrors[detail.field] = detail.message;
          }
        }
        if (Object.keys(serverErrors).length) setErrors((current) => ({ ...current, ...serverErrors }));
        else setSubmitError(error.message);
      } else {
        setSubmitError("Não foi possível enviar sua solicitação. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (registration) {
    return <div className="login-form registration-form registration-success" role="status">
      <Link className="auth-back-link" href="/"><ArrowLeft aria-hidden="true" />Voltar ao login</Link>
      <div className="registration-success-icon" aria-hidden="true"><Check /></div>
      <div className="login-heading registration-heading">
        <p className="eyebrow">Solicitação recebida</p>
        <h1>Cadastro pendente</h1>
        <p>Recebemos a solicitação de <strong>{registration.email}</strong>. O acesso será liberado somente após a aprovação de um administrador.</p>
      </div>
      <Link className="primary-button login-button registration-button" href="/">
        <span>Voltar ao login</span><span className="login-button-arrow" aria-hidden="true"><ArrowRight /></span>
      </Link>
    </div>;
  }

  return <form ref={formRef} className="login-form registration-form" noValidate onSubmit={handleSubmit}>
    <Link className="auth-back-link" href="/"><ArrowLeft aria-hidden="true" />Voltar ao login</Link>
    <div className="login-heading registration-heading">
      <p className="eyebrow">Solicitação de acesso</p>
      <h1>Criar sua conta</h1>
      <p>Preencha seus dados. O acesso será liberado somente após a aprovação de um administrador.</p>
    </div>

    <label htmlFor="registration-name">
      <span>Nome completo</span>
      <input
        id="registration-name"
        name="nome"
        type="text"
        minLength={2}
        maxLength={200}
        autoComplete="name"
        aria-invalid={Boolean(errors.nome)}
        aria-describedby={errors.nome ? "registration-name-error" : undefined}
        disabled={loading}
        value={values.nome}
        onChange={(event) => update("nome", event.target.value)}
      />
      {errors.nome && <small className="auth-field-error" id="registration-name-error">{errors.nome}</small>}
    </label>

    <label htmlFor="registration-email">
      <span>E-mail</span>
      <input
        id="registration-email"
        name="email"
        type="email"
        maxLength={254}
        autoComplete="email"
        inputMode="email"
        aria-invalid={Boolean(errors.email)}
        aria-describedby={errors.email ? "registration-email-error" : undefined}
        disabled={loading}
        value={values.email}
        onChange={(event) => update("email", event.target.value)}
      />
      {errors.email && <small className="auth-field-error" id="registration-email-error">{errors.email}</small>}
    </label>

    <div className="registration-password-grid">
      <PasswordField
        autoComplete="new-password"
        disabled={loading}
        error={errors.senha}
        id="registration-password"
        label="Senha"
        name="senha"
        onChange={(value) => update("senha", value)}
        onToggle={() => setRevealPassword((current) => !current)}
        reveal={revealPassword}
        value={values.senha}
      />
      <PasswordField
        autoComplete="new-password"
        disabled={loading}
        error={errors.confirmarSenha}
        id="registration-password-confirmation"
        label="Confirmar senha"
        name="confirmarSenha"
        onChange={(value) => update("confirmarSenha", value)}
        onToggle={() => setRevealConfirmation((current) => !current)}
        reveal={revealConfirmation}
        value={values.confirmarSenha}
      />
    </div>
    <p className="registration-password-hint">Use pelo menos 8 caracteres. A senha será protegida antes de ser armazenada.</p>

    {submitError && <p className="login-api-error" role="alert">{submitError}</p>}

    <button className="primary-button login-button registration-button" disabled={loading} aria-busy={loading}>
      {loading
        ? <><span className="spinner" aria-hidden="true" /> Enviando solicitação</>
        : <><span>Solicitar acesso</span><span className="login-button-arrow" aria-hidden="true"><ArrowRight /></span></>}
    </button>

    <div className="registration-approval-note">
      <Clock3 aria-hidden="true" />
      <p><strong>Cadastro sujeito à aprovação</strong><small>Você ainda não terá acesso ao sistema até que sua solicitação seja analisada.</small></p>
    </div>
  </form>;
}
