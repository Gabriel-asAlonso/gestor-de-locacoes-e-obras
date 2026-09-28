"use client";

import type { ChangeEvent } from "react";
import { useId, useRef } from "react";
import { ArrowDownToLine, Paperclip, X } from "lucide-react";

type FileFieldProps = {
  label: string;
  hint?: string;
  accept?: string;
  multiple?: boolean;
  value: string[];
  onChange: (names: string[]) => void;
  /** Recebe os arquivos reais para persistência; opcional para formulários que usam apenas nomes. */
  onFilesChange?: (files: File[]) => void;
  optional?: boolean;
  disabled?: boolean;
  className?: string;
  /** Quando definido, os nomes escolhidos são espelhados em inputs ocultos com esse `name`, para leitura via FormData. */
  name?: string;
};

/**
 * Campo de anexo localizado. Substitui o `<input type="file">` nativo
 * ("Choose Files / No file chosen") por uma área em português com lista
 * de arquivos escolhidos. Com `onFilesChange`, também preserva os objetos File
 * para que o formulário possa enviar os bytes reais à API.
 */
export function FileField({ label, hint, accept, multiple = false, value, onChange, onFilesChange, optional = false, disabled = false, className = "", name }: FileFieldProps) {
  const hintId = useId();
  const selectedFiles = useRef<File[]>([]);

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    const names = picked.map((file) => file.name).filter(Boolean);
    event.target.value = "";
    if (!names.length) return;
    if (onFilesChange) {
      selectedFiles.current = multiple
        ? [...selectedFiles.current.filter((file) => !picked.some((candidate) => candidate.name === file.name)), ...picked]
        : picked.slice(0, 1);
      onFilesChange(selectedFiles.current);
    }
    onChange(multiple ? Array.from(new Set([...value, ...names])) : names.slice(0, 1));
  };

  const removeName = (target: string) => {
    if (onFilesChange) {
      selectedFiles.current = selectedFiles.current.filter((file) => file.name !== target);
      onFilesChange(selectedFiles.current);
    }
    onChange(value.filter((entry) => entry !== target));
  };

  const cta = value.length
    ? (multiple ? "Adicionar outro arquivo" : "Trocar arquivo")
    : (multiple ? "Escolher arquivos" : "Escolher arquivo");

  return (
    <div className={`file-field ${className}`.trim()}>
      <span className="file-field-label">{label}{optional && <em>opcional</em>}</span>
      <label className={`file-field-drop ${disabled ? "is-disabled" : ""}`.trim()}>
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={handleInput}
          aria-describedby={hint ? hintId : undefined}
        />
        <ArrowDownToLine aria-hidden="true" />
        <span className="file-field-cta">{cta}</span>
        {hint && <small id={hintId}>{hint}</small>}
      </label>
      {value.length > 0 && (
        <ul className="file-field-list">
          {value.map((fileName) => (
            <li key={fileName}>
              <Paperclip aria-hidden="true" />
              <span>{fileName}</span>
              <button type="button" onClick={() => removeName(fileName)} disabled={disabled} aria-label={`Remover ${fileName}`}>
                <X aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {name && value.map((fileName) => <input key={fileName} type="hidden" name={name} value={fileName} />)}
    </div>
  );
}
