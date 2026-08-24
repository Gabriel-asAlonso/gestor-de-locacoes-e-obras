"use client";
/* eslint-disable @next/next/no-img-element -- As prévias usam URLs blob temporárias, incompatíveis com next/image. */

import type { ChangeEvent, DragEvent } from "react";
import { useId, useRef, useState } from "react";
import {
  DOCUMENT_ACCEPT,
  REGISTRY_DOCUMENT_TOPICS,
  countCategorizedDocuments,
  documentFingerprint,
  documentIconLabel,
  documentTypeLabel,
  fileExtension,
  formatDocumentSize,
  isImageDocument,
  validateDocumentFile,
  type CategorizedDocuments,
  type LocalDocument,
} from "./local-documents";

type DocumentManagerProps = {
  documents: LocalDocument[];
  onChange: (documents: LocalDocument[]) => void;
  onRemove?: (document: LocalDocument) => void;
  embedded?: boolean;
  title?: string;
  description?: string;
};

type DocumentCollectionProps = {
  documents: LocalDocument[];
  onRemove?: (document: LocalDocument) => void;
  emptyDescription?: string;
};

export function DocumentCollection({ documents, onRemove, emptyDescription = "Os arquivos ficarão disponíveis somente durante esta sessão." }: DocumentCollectionProps) {
  const headingId = useId();
  const images = documents.filter(isImageDocument);
  const files = documents.filter((document) => !isImageDocument(document));

  if (documents.length === 0) return <div className="document-empty"><span aria-hidden="true">□</span><div><strong>Nenhum documento anexado</strong><small>{emptyDescription}</small></div></div>;

  return <div className="document-collection">
    {images.length > 0 && <section className="document-collection-group" aria-labelledby={`${headingId}-images`}>
      <div className="document-subheading"><h4 id={`${headingId}-images`}>Imagens</h4><span>{images.length} {images.length === 1 ? "imagem" : "imagens"}</span></div>
      <ul className="document-image-gallery">
        {images.map((document) => <li key={document.id}>
          <a className="document-image-preview" href={document.objectUrl} target="_blank" rel="noreferrer" aria-label={`Abrir ${document.name} em tamanho completo`}>
            <img src={document.objectUrl} alt={document.name} />
          </a>
          <div className="document-image-caption"><div><strong title={document.name}>{document.name}</strong><span>{formatDocumentSize(document.size)}</span></div><div className="document-actions">
            <a href={document.objectUrl} target="_blank" rel="noreferrer" className="document-action" aria-label={`Ampliar ${document.name}`}>Ampliar</a>
            <a href={document.objectUrl} download={document.name} className="document-action" aria-label={`Baixar ${document.name}`}>Baixar</a>
            {onRemove && <button type="button" className="document-action document-remove" onClick={() => onRemove(document)} aria-label={`Remover ${document.name}`}>Remover</button>}
          </div></div>
        </li>)}
      </ul>
    </section>}

    {files.length > 0 && <section className="document-collection-group" aria-labelledby={`${headingId}-files`}>
      <div className="document-subheading"><h4 id={`${headingId}-files`}>Arquivos</h4><span>{files.length} {files.length === 1 ? "arquivo" : "arquivos"}</span></div>
      <ul className="document-list">
        {files.map((document) => <li key={document.id}>
          <span className={`document-file-icon file-${document.extension}`} aria-hidden="true">{documentIconLabel(document.extension)}</span>
          <div className="document-file-info"><strong title={document.name}>{document.name}</strong><span>{document.typeLabel} · {formatDocumentSize(document.size)}</span></div>
          <div className="document-actions">
            <a href={document.objectUrl} target="_blank" rel="noreferrer" className="document-action" aria-label={`Abrir ${document.name}`} title="Abrir arquivo">Abrir</a>
            <a href={document.objectUrl} download={document.name} className="document-action" aria-label={`Baixar ${document.name}`} title="Baixar arquivo">Baixar</a>
            {onRemove && <button type="button" className="document-action document-remove" onClick={() => onRemove(document)} aria-label={`Remover ${document.name}`} title="Remover arquivo">Remover</button>}
          </div>
        </li>)}
      </ul>
    </section>}
  </div>;
}

export function DocumentManager({ documents, onChange, onRemove, embedded = false, title = "Documentos", description = "PDF, Word, Excel, JPG ou PNG · até 10 MB por arquivo." }: DocumentManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const addFiles = (files: FileList | File[]) => {
    const nextDocuments: LocalDocument[] = [];
    const nextErrors: string[] = [];
    const fingerprints = new Set(documents.map((document) => documentFingerprint(document.file)));

    Array.from(files).forEach((file) => {
      const extension = fileExtension(file.name);
      const fingerprint = documentFingerprint(file);
      const validationError = validateDocumentFile(file, fingerprints);
      if (validationError) {
        nextErrors.push(validationError);
        return;
      }

      fingerprints.add(fingerprint);
      nextDocuments.push({
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        name: file.name,
        extension,
        typeLabel: documentTypeLabel(extension),
        size: file.size,
        objectUrl: URL.createObjectURL(file),
      });
    });

    setErrors(nextErrors);
    if (nextDocuments.length) onChange([...documents, ...nextDocuments]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files);
  };

  const handleDrag = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === "dragenter" || event.type === "dragover") setDragging(true);
    if (event.type === "dragleave") setDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
  };

  const removeDocument = (document: LocalDocument) => {
    onRemove?.(document);
    onChange(documents.filter((item) => item.id !== document.id));
    setErrors([]);
  };

  return <section className={`document-manager full-field ${embedded ? "document-manager-embedded" : ""}`} aria-labelledby={headingId}>
    <div className="document-manager-heading">
      <div><h3 id={headingId}>{title}</h3><p>{description}</p></div>
      {documents.length > 0 && <span>{documents.length} {documents.length === 1 ? "arquivo" : "arquivos"}</span>}
    </div>

    <div className={`document-dropzone ${dragging ? "is-dragging" : ""}`} onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}>
      <input ref={inputRef} className="sr-only" type="file" multiple accept={DOCUMENT_ACCEPT} onChange={handleInput} aria-label={`Selecionar arquivos para ${title.toLocaleLowerCase("pt-BR")}`} />
      <span className="document-drop-icon" aria-hidden="true">+</span>
      <div><strong>Arraste arquivos para esta área</strong><small>ou selecione no seu dispositivo</small></div>
      <button type="button" className="secondary-button document-add-button" onClick={() => inputRef.current?.click()}>Adicionar documento</button>
    </div>

    {errors.length > 0 && <div className="document-errors" role="alert"><span aria-hidden="true">!</span><div><strong>Alguns arquivos não foram adicionados</strong><ul>{errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul></div></div>}

    <DocumentCollection documents={documents} onRemove={removeDocument} />
  </section>;
}

type CategorizedDocumentManagerProps = {
  documents: CategorizedDocuments;
  onChange: (documents: CategorizedDocuments) => void;
  onRemove?: (document: LocalDocument) => void;
};

export function CategorizedDocumentManager({ documents, onChange, onRemove }: CategorizedDocumentManagerProps) {
  const headingId = useId();
  const total = countCategorizedDocuments(documents);

  return <section className="document-topics-manager full-field" aria-labelledby={headingId}>
    <div className="document-topics-heading">
      <div><h3 id={headingId}>Anexos por tópico</h3><p>Abra um tópico para adicionar e consultar seus arquivos.</p></div>
      <span>{total ? `${total} ${total === 1 ? "anexo" : "anexos"}` : "Sem anexos"}</span>
    </div>
    <div className="document-topic-list">
      {REGISTRY_DOCUMENT_TOPICS.map((topic, index) => {
        const topicDocuments = documents[topic.id] ?? [];
        return <details className="document-topic" key={topic.id} open={index === 0 || topicDocuments.length > 0}>
          <summary>
            <span className="document-topic-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <span className="document-topic-copy"><strong>{topic.label}</strong><small>{topic.description}</small></span>
            <span className={`document-topic-count ${topicDocuments.length ? "has-documents" : ""}`}>{topicDocuments.length ? `${topicDocuments.length} ${topicDocuments.length === 1 ? "anexo" : "anexos"}` : "Sem anexos"}</span>
            <span className="document-topic-chevron" aria-hidden="true" />
          </summary>
          <div className="document-topic-content">
            <DocumentManager
              embedded
              title={`Adicionar em ${topic.label}`}
              description="PDF, Word, Excel, JPG ou PNG · até 10 MB por arquivo."
              documents={topicDocuments}
              onChange={(nextDocuments) => onChange({ ...documents, [topic.id]: nextDocuments })}
              onRemove={onRemove}
            />
          </div>
        </details>;
      })}
    </div>
  </section>;
}

export function CategorizedDocumentCollection({ documents }: { documents: CategorizedDocuments }) {
  return <div className="categorized-document-collection document-topic-list">
    {REGISTRY_DOCUMENT_TOPICS.map((topic, index) => {
      const topicDocuments = documents[topic.id] ?? [];
      return <details className="document-topic" key={topic.id} open={topicDocuments.length > 0}>
        <summary>
          <span className="document-topic-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <span className="document-topic-copy"><strong>{topic.label}</strong><small>{topic.description}</small></span>
          <span className={`document-topic-count ${topicDocuments.length ? "has-documents" : ""}`}>{topicDocuments.length ? `${topicDocuments.length} ${topicDocuments.length === 1 ? "anexo" : "anexos"}` : "Sem anexos"}</span>
          <span className="document-topic-chevron" aria-hidden="true" />
        </summary>
        <div className="document-topic-content document-topic-preview">
          <DocumentCollection documents={topicDocuments} emptyDescription={`Nenhum arquivo em ${topic.label.toLocaleLowerCase("pt-BR")} nesta sessão.`} />
        </div>
      </details>;
    })}
  </div>;
}
