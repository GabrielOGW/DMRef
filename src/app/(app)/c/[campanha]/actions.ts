'use server';

import { redirect } from 'next/navigation';

import { exigirUsuario } from '@/auth';
import { buscarCampanha } from '@/domain/campaigns';
import { salvarDocumento } from '@/domain/documents';
import { criarEntidade } from '@/domain/entities';
import { criarSessao } from '@/domain/sessions';
import type { TiptapDoc } from '@/db/schema';

export async function criarEntidadeAction(_estado: string | null, dados: FormData) {
  const usuario = await exigirUsuario();
  const campanhaSlug = String(dados.get('campanha') ?? '');
  const name = String(dados.get('name') ?? '').trim();
  if (!name) return 'Dê um nome à página.';

  const campanha = await buscarCampanha(usuario.id, campanhaSlug);
  if (!campanha) return 'Campanha não encontrada.';

  const entidade = await criarEntidade({
    campaignId: campanha.id,
    name,
    typeKey: String(dados.get('typeKey') ?? '') || undefined,
  });
  redirect(`/c/${campanha.slug}/e/${entidade.slug}`);
}

/** Devolve o novo `updatedAt` — é a versão de que o rascunho local passa a depender. */
export async function salvarDocumentoAction(entityId: string, content: TiptapDoc) {
  const usuario = await exigirUsuario();
  const salvoEm = await salvarDocumento({ ownerId: usuario.id, entityId, content });
  return salvoEm.toISOString();
}

/** Abre a sessão seguinte da campanha e cai direto no editor, com o corpo em foco. */
export async function criarSessaoAction(dados: FormData) {
  const usuario = await exigirUsuario();
  const campanhaSlug = String(dados.get('campanha') ?? '');
  const campanha = await buscarCampanha(usuario.id, campanhaSlug);
  if (!campanha) throw new Error('Campanha não encontrada');

  const sessao = await criarSessao(campanha.id);
  redirect(`/c/${campanha.slug}/e/${sessao.slug}`);
}

/**
 * Nasce a entidade que a menção acabou de inserir no texto. O id vem do cliente
 * (UUIDv7) porque o nó já entrou com ele — esperar o servidor aqui é exatamente
 * o que o §6.1 evita. Entidade válida é `{ nome, tipo }`, nada mais é exigido.
 */
export async function criarEntidadeMencionadaAction(
  campanhaSlug: string,
  entrada: { id: string; name: string; typeKey: string },
) {
  const usuario = await exigirUsuario();
  const campanha = await buscarCampanha(usuario.id, campanhaSlug);
  if (!campanha) throw new Error('Campanha não encontrada');

  await criarEntidade({
    campaignId: campanha.id,
    id: entrada.id,
    name: entrada.name,
    typeKey: entrada.typeKey,
  });
}
