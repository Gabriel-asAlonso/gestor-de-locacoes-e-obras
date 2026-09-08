import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const expectedRoutes = [
  "login", "inicio", "carteiras", "imoveis", "unidades", "locatarios",
  "contratos", "cobrancas", "despesas", "obras/inicio", "obras",
  "obras/nova", "obras/:id/editar", "obras/:id",
];

test("declara rotas Angular para todas as páginas migradas", async () => {
  const source = await readFile(new URL("../src/app/app.routes.ts", import.meta.url), "utf8");
  for (const route of expectedRoutes) {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(source, new RegExp(`path:\\s*['\"]${escaped}['\"]`));
  }
  assert.match(source, /canActivate:\s*\[authGuard\]/);
  assert.match(source, /path:\s*['"]\*\*['"],\s*redirectTo/);
});
