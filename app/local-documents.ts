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

export const REGISTRY_DOCUMENT_TOPICS = [
  {
    id: "property-contract",
    label: "Contrato do imóvel",
    description: "Instrumentos de aquisição, administração ou cessão do imóvel.",
  },
  {
    id: "property-documentation",
    label: "Documentação do imóvel",
    description: "Matrícula, escritura, certidões, IPTU, plantas e documentos cadastrais.",
  },
  {
    id: "property-photos",
    label: "Fotos do imóvel",
    description: "Registros da fachada, ambientes, áreas comuns e demais espaços.",
  },
  {
    id: "handover-inspection",
    label: "Vistoria — entrega do imóvel",
    description: "Laudos, termos e imagens produzidos na vistoria de entrega.",
  },
  {
    id: "maintenance",
    label: "Manutenções",
    description: "Ordens de serviço, orçamentos, notas, comprovantes e fotos.",
  },
  {
    id: "lease-contract",
    label: "Contrato de locação",
    description: "Contrato de locação, aditivos, garantias e documentos relacionados.",
  },
] as const;

export type RegistryDocumentTopicId = (typeof REGISTRY_DOCUMENT_TOPICS)[number]["id"];
export type CategorizedDocuments = Record<RegistryDocumentTopicId, LocalDocument[]>;

export function createEmptyCategorizedDocuments(): CategorizedDocuments {
  return Object.fromEntries(REGISTRY_DOCUMENT_TOPICS.map((topic) => [topic.id, []])) as unknown as CategorizedDocuments;
}

export function flattenCategorizedDocuments(documents: CategorizedDocuments) {
  return REGISTRY_DOCUMENT_TOPICS.flatMap((topic) => documents[topic.id] ?? []);
}

export function countCategorizedDocuments(documents: CategorizedDocuments) {
  return flattenCategorizedDocuments(documents).length;
}

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
