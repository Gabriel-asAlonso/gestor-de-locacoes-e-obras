import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("a distribuição Angular contém a raiz, metadados e assets do produto", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<app-root><\/app-root>/i);
  assert.match(html, /<title>Locações e Recebíveis — Gestão patrimonial<\/title>/i);
  assert.match(html, /name="description"/i);
  assert.match(html, /property="og:image" content="\/og-properties-v2\.png"/i);
  assert.doesNotMatch(html, /codex-preview/i);
});
