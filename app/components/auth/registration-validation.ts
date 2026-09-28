export interface RegistrationValues {
  nome: string;
  email: string;
  senha: string;
  confirmarSenha: string;
}

export type RegistrationField = keyof RegistrationValues;
export type RegistrationErrors = Partial<Record<RegistrationField, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegistration(values: RegistrationValues): RegistrationErrors {
  const errors: RegistrationErrors = {};
  const nome = values.nome.trim();
  const email = values.email.trim();

  if (!nome) errors.nome = "Informe seu nome completo.";
  else if (nome.length < 2) errors.nome = "O nome deve ter pelo menos 2 caracteres.";
  else if (nome.length > 200) errors.nome = "O nome deve ter no máximo 200 caracteres.";

  if (!email) errors.email = "Informe seu e-mail.";
  else if (email.length > 254 || !EMAIL_PATTERN.test(email)) errors.email = "Informe um e-mail válido.";

  if (!values.senha) errors.senha = "Crie uma senha.";
  else if (values.senha.length < 8) errors.senha = "A senha deve ter pelo menos 8 caracteres.";
  else if (values.senha.length > 200) errors.senha = "A senha deve ter no máximo 200 caracteres.";

  if (!values.confirmarSenha) errors.confirmarSenha = "Confirme sua senha.";
  else if (values.confirmarSenha !== values.senha) errors.confirmarSenha = "As senhas não coincidem.";

  return errors;
}
