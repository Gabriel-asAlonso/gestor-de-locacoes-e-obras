"use client";

import { Eye, EyeOff } from "lucide-react";

interface PasswordFieldProps {
  autoComplete: "new-password";
  disabled?: boolean;
  error?: string;
  id: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  onToggle: () => void;
  reveal: boolean;
  value: string;
}

export function PasswordField({
  autoComplete,
  disabled,
  error,
  id,
  label,
  name,
  onChange,
  onToggle,
  reveal,
  value,
}: PasswordFieldProps) {
  const errorId = `${id}-error`;
  return <label htmlFor={id}>
    <span>{label}</span>
    <span className="auth-password-control">
      <input
        id={id}
        name={name}
        type={reveal ? "text" : "password"}
        minLength={8}
        maxLength={200}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="auth-password-toggle"
        onClick={onToggle}
        disabled={disabled}
        aria-label={reveal ? `Ocultar ${label.toLocaleLowerCase("pt-BR")}` : `Mostrar ${label.toLocaleLowerCase("pt-BR")}`}
        aria-pressed={reveal}
      >
        {reveal ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
    </span>
    {error && <small className="auth-field-error" id={errorId}>{error}</small>}
  </label>;
}
