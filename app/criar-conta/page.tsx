"use client";

import { AuthShell } from "../components/auth/auth-shell";
import { RegistrationForm } from "../components/auth/registration-form";
import { registrationService } from "../services/registration.service";

export default function CreateAccountPage() {
  return <AuthShell
    contextDescription="Solicite acesso para sua conta"
    contextTitle="Novo cadastro"
    panelLabel="Cadastro de usuário"
    variant="register"
  >
    <RegistrationForm onRegister={({ nome, email, senha }) => registrationService.request({ nome, email, senha })} />
  </AuthShell>;
}
