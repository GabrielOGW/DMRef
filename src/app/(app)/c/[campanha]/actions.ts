'use server';

import { redirect } from 'next/navigation';

import { exigirUsuario } from '@/auth';
import { buscarCampanha } from '@/domain/campaigns';
import { salvarDocumento } from '@/domain/documents';
import { criarEntidade } from '@/domain/entities';
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
