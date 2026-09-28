import assert from "node:assert/strict";
import test from "node:test";
import { validateRegistration } from "../app/components/auth/registration-validation.ts";

test("accepts the four required registration fields when they are valid", () => {
  assert.deepEqual(validateRegistration({
    nome: "Gabriel Alonso",
    email: "gabriel@example.com",
    senha: "senha-segura",
    confirmarSenha: "senha-segura",
  }), {});
});

test("requires name, email, password and password confirmation", () => {
  const errors = validateRegistration({ nome: " ", email: "", senha: "", confirmarSenha: "" });
  assert.deepEqual(Object.keys(errors), ["nome", "email", "senha", "confirmarSenha"]);
});

test("rejects invalid email, short password and mismatched confirmation", () => {
  const errors = validateRegistration({
    nome: "G",
    email: "email-invalido",
    senha: "1234567",
    confirmarSenha: "outra-senha",
  });
  assert.match(errors.nome, /pelo menos 2/i);
  assert.match(errors.email, /e-mail válido/i);
  assert.match(errors.senha, /pelo menos 8/i);
  assert.match(errors.confirmarSenha, /não coincidem/i);
});

test("enforces the persistence limits without normalizing the password", () => {
  const errors = validateRegistration({
    nome: "N".repeat(201),
    email: `${"e".repeat(246)}@teste.com`,
    senha: "s".repeat(201),
    confirmarSenha: "s".repeat(201),
  });
  assert.match(errors.nome, /200/);
  assert.match(errors.email, /válido/i);
  assert.match(errors.senha, /200/);
  assert.equal(errors.confirmarSenha, undefined);
});
