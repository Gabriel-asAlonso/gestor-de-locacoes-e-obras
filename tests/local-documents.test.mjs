import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_DOCUMENT_SIZE_BYTES,
  documentFingerprint,
  formatDocumentSize,
  isImageDocument,
  validateDocumentFile,
} from "../app/local-documents.ts";

test("aceita os formatos configurados, inclusive extensões em maiúsculas", () => {
  const names = ["arquivo.pdf", "arquivo.doc", "arquivo.docx", "arquivo.xls", "arquivo.xlsx", "foto.jpg", "foto.jpeg", "foto.PNG"];
  for (const name of names) {
    assert.equal(validateDocumentFile(new File(["conteúdo"], name), new Set()), "");
  }
});

test("bloqueia formato inválido, arquivo vazio, excesso de tamanho e duplicidade", () => {
  const validFile = new File(["conteúdo"], "contrato.pdf");
  assert.match(validateDocumentFile(new File(["x"], "script.exe"), new Set()), /formato não permitido/);
  assert.match(validateDocumentFile(new File([], "vazio.pdf"), new Set()), /arquivo está vazio/);
  assert.match(validateDocumentFile(new File([new Uint8Array(MAX_DOCUMENT_SIZE_BYTES + 1)], "grande.pdf"), new Set()), /limite de 10 MB/);
  assert.match(validateDocumentFile(validFile, new Set([documentFingerprint(validFile)])), /já foi adicionado/);
});

test("formata tamanhos para apresentação", () => {
  assert.equal(formatDocumentSize(900), "900 B");
  assert.equal(formatDocumentSize(1024), "1 KB");
  assert.equal(formatDocumentSize(1024 * 1024), "1 MB");
});

test("separa imagens dos demais documentos para a galeria", () => {
  assert.equal(isImageDocument({ extension: "jpg" }), true);
  assert.equal(isImageDocument({ extension: "jpeg" }), true);
  assert.equal(isImageDocument({ extension: "png" }), true);
  assert.equal(isImageDocument({ extension: "pdf" }), false);
  assert.equal(isImageDocument({ extension: "docx" }), false);
});
