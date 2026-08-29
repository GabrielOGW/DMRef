'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { exigirUsuario } from '@/auth';
import { buscarCampanha } from '@/domain/campaigns';
import { salvarDocumento } from '@/domain/documents';
import {
  arquivarEntidade,
  criarEntidade,
  desarquivarEntidade,
  mudarTipoDaEntidade,
  renomearEntidade,
} from '@/domain/entities';
import { criarSessao } from '@/domain/sessions';
import { criarTipoDeEntidade } from '@/domain/tipos';
import type { TiptapDoc } from '@/db/schema';

/**
 * A barra lateral é do layout, e layout não re-executa em navegação entre rotas
 * irmãs — sem isto, a categoria nova ou a contagem só apareceriam num F5.
 *
 * De propósito **não** vale para a criação vinda do `@`: aquela roda enquanto
 * alguém digita, e revalidar mandaria props novas para o editor no meio da
 * frase. A contagem se acerta na navegação seguinte.
 */
function atualizarBarra(campanhaSlug: string) {
  revalidatePath(`/c/${campanhaSlug}`, 'layout');
}

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
  atualizarBarra(campanha.slug);
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
  atualizarBarra(campanha.slug);
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

/**
 * Consertar o que se errou escrevendo rápido: renomear, trocar o tipo, arquivar.
 * Um formulário só, porque na prática é um gesto só — "esta página está errada".
 *
 * Redireciona em vez de revalidar: navegação nova remonta o editor com props
 * limpas, em vez de trocá-las por baixo de quem talvez esteja digitando.
 */
export async function editarEntidadeAction(dados: FormData) {
  const usuario = await exigirUsuario();
  const campanhaSlug = String(dados.get('campanha') ?? '');
  const entityId = String(dados.get('entityId') ?? '');
  const acao = String(dados.get('acao') ?? 'salvar');

  if (acao === 'arquivar') {
    await arquivarEntidade(usuario.id, entityId);
    atualizarBarra(campanhaSlug);
    redirect(`/c/${campanhaSlug}`);
  }

  if (acao === 'desarquivar') {
    const { slug } = await desarquivarEntidade(usuario.id, entityId);
    atualizarBarra(campanhaSlug);
    redirect(`/c/${campanhaSlug}/e/${slug}`);
  }

  const nome = String(dados.get('name') ?? '').trim();
  const typeKey = String(dados.get('typeKey') ?? '');
  if (nome) await renomearEntidade(usuario.id, entityId, nome);
  if (typeKey) await mudarTipoDaEntidade(usuario.id, entityId, typeKey);
  atualizarBarra(campanhaSlug);

  redirect(`/c/${campanhaSlug}/e/${String(dados.get('slug') ?? '')}`);
}

/**
 * Categoria nova da campanha. As padrões são globais (`campaign_id NULL`) e não
 * há como excluí-las — nem elas, nem estas: apagar um tipo deixaria entidades
 * apontando para uma chave que não existe mais.
 */
export async function criarCategoriaAction(dados: FormData) {
  const usuario = await exigirUsuario();
  const campanhaSlug = String(dados.get('campanha') ?? '');
  const campanha = await buscarCampanha(usuario.id, campanhaSlug);
  if (!campanha) throw new Error('Campanha não encontrada');

  const { key } = await criarTipoDeEntidade(campanha.id, String(dados.get('nome') ?? ''));
  atualizarBarra(campanha.slug);
  redirect(`/c/${campanha.slug}/t/${key}`);
}
