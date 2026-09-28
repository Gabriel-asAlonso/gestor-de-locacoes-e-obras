import { LockKeyhole } from 'lucide-react';
import { PERMISSION_GROUPS } from './permission-catalog';

export function PermissionEditor({ selected, editable, onChange, locked, loading }: { selected: Set<string>; editable: ReadonlySet<string>; onChange: (next: Set<string>) => void; locked: boolean; loading?: boolean }) {
  const togglePermission = (code: string) => {
    if (locked || !editable.has(code)) return;
    const next = new Set(selected);
    if (next.has(code)) next.delete(code); else next.add(code);
    onChange(next);
  };
  const toggleGroup = (codes: string[]) => {
    if (locked) return;
    const editableCodes = codes.filter(code => editable.has(code));
    const next = new Set(selected);
    const allSelected = editableCodes.length > 0 && editableCodes.every(code => next.has(code));
    for (const code of editableCodes) {
      if (allSelected) next.delete(code); else next.add(code);
    }
    onChange(next);
  };

  return <section className="permission-editor" aria-labelledby="permission-editor-title">
    <header><div><p className="eyebrow">Permissões por módulo</p><h3 id="permission-editor-title">Acessos disponíveis</h3></div><span>{selected.size} selecionadas</span></header>
    {loading ? <p className="permission-lock-note">Carregando permissões atuais…</p> : <div className="permission-group-grid">
      {PERMISSION_GROUPS.map(group => {
        const availableCodes = group.permissions.map(permission => permission.code);
        const editableCodes = availableCodes.filter(code => editable.has(code));
        const selectedCount = availableCodes.filter(code => selected.has(code)).length;
        const allSelected = editableCodes.length > 0 && editableCodes.every(code => selected.has(code));
        return <section className="permission-group" key={group.id}>
          <header>
            <div><strong>{group.label}</strong><small>{group.description}</small></div>
            <button type="button" role="checkbox" aria-checked={allSelected ? 'true' : selectedCount ? 'mixed' : 'false'} disabled={locked || !editableCodes.length} onClick={() => toggleGroup(availableCodes)}>{allSelected ? 'Remover grupo' : 'Selecionar grupo'}</button>
          </header>
          <div className="permission-items">
            {group.permissions.map(permission => <label key={permission.code} className={!editable.has(permission.code) ? 'is-planned' : ''}>
              <input type="checkbox" checked={selected.has(permission.code)} disabled={locked || !editable.has(permission.code)} onChange={() => togglePermission(permission.code)} />
              <span aria-hidden="true" />
              <p><strong>{permission.label}{!editable.has(permission.code) && !locked && <em>Não delegável</em>}</strong><small>{permission.description}</small></p>
            </label>)}
          </div>
        </section>;
      })}
    </div>}
    {locked && <p className="permission-lock-note"><LockKeyhole aria-hidden="true" />O acesso estrutural de um usuário Master não pode ser reduzido nesta tela.</p>}
  </section>;
}
