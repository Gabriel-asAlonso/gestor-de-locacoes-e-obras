import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AVAILABLE_PERMISSION_CODES, PERMISSION_GROUPS } from '../app/components/access-management/permission-catalog.ts';
import { PERMISSIONS } from '../server/permissions/permissions.ts';

test('catálogo visual cobre todas as permissões já protegidas pelo backend', () => {
  assert.deepEqual([...AVAILABLE_PERMISSION_CODES].sort(), Object.values(PERMISSIONS).sort());
  assert.ok(PERMISSION_GROUPS.some(group => group.id === 'administracao'));
  assert.ok(PERMISSION_GROUPS.flatMap(group => group.permissions).some(permission => permission.code === 'permissoes:editar'));
});

test('tela da Fase 4 usa ações reais e mantém dados sensíveis fora da interface', () => {
  const source = readFileSync(new URL('../app/components/access-management/access-management-page.tsx', import.meta.url), 'utf8');
  const actions = readFileSync(new URL('../app/components/access-management/pending-user-actions.tsx', import.meta.url), 'utf8');
  assert.match(source, /Usuários e acessos/);
  assert.match(source, /Autorização integrada ao backend/);
  assert.match(source, /userAccessService\.savePermissions/);
  assert.match(source, /userAccessService\.approve/);
  assert.match(source, /Salvar alterações/);
  assert.match(actions, /Rejeitar/);
  assert.match(actions, /Aprovar acesso/);
  assert.doesNotMatch(source + actions, /Disponível após a implementação da Fase 4/);
  assert.doesNotMatch(source + actions, /senha_hash|refreshToken|senha-segura/);
});
