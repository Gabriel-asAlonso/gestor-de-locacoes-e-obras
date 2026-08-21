export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png";

const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png"]);

export type LocalDocument = {
  id: string;
  file: File;
  name: string;
  extension: string;
  typeLabel: string;
  size: number;
  objectUrl: string;
};

export function fileExtension(name: string) {
  return name.includes(".") ? name.split(".").pop()?.toLowerCase() ?? "" : "";
}

export function documentTypeLabel(extension: string) {
  if (extension === "pdf") return "Documento PDF";
  if (extension === "doc" || extension === "docx") return "Documento Word";
  if (extension === "xls" || extension === "xlsx") return "Planilha Excel";
  if (extension === "jpg" || extension === "jpeg") return "Imagem JPEG";
  return "Imagem PNG";
}

export function documentIconLabel(extension: string) {
  if (extension === "docx") return "DOC";
  if (extension === "xlsx") return "XLS";
  if (extension === "jpeg") return "JPG";
  return extension.toUpperCase();
}

export function isImageDocument(document: Pick<LocalDocument, "extension">) {
  return document.extension === "jpg" || document.extension === "jpeg" || document.extension === "png";
}

export function documentFingerprint(file: Pick<File, "name" | "size">) {
  return `${file.name.trim().toLocaleLowerCase("pt-BR")}::${file.size}`;
}

export function validateDocumentFile(file: File, fingerprints: ReadonlySet<string>) {
  const extension = fileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.has(extension)) return `${file.name}: formato não permitido.`;
  if (file.size === 0) return `${file.name}: o arquivo está vazio.`;
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) return `${file.name}: excede o limite de 10 MB.`;
  if (fingerprints.has(documentFingerprint(file))) return `${file.name}: este arquivo já foi adicionado.`;
  return "";
}

export function formatDocumentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

export function revokeDocumentUrls(documents: LocalDocument[]) {
  documents.forEach((document) => URL.revokeObjectURL(document.objectUrl));
}
