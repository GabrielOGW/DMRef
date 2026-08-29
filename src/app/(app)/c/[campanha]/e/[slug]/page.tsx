import Link from 'next/link';
import { notFound } from 'next/navigation';

import { exigirUsuario } from '@/auth';
import { buscarEntidade, listarEntidades, listarTiposDeEntidade } from '@/domain/entities';
import { Editor } from '@/editor/Editor';

import { criarEntidadeMencionadaAction, salvarDocumentoAction } from '../../actions.ts';

// Uma rota para toda entidade: o tipo escolhe quais painéis renderizam, não qual
// arquivo existe (ARQUITETURA.md §8).
export default async function Entidade({ params }: PageProps<'/c/[campanha]/e/[slug]'>) {
  const usuario = await exigirUsuario();
  const { campanha: campanhaSlug, slug } = await params;

  const linha = await buscarEntidade(usuario.id, campanhaSlug, slug);
  if (!linha) notFound();
  const { entidade, campanha } = linha;

  // A campanha inteira de uma vez: o `@` filtra em memória, sem rede no meio da
  // digitação (ARQUITETURA.md §6.1).
  const [mencionaveis, tipos] = await Promise.all([
    listarEntidades(campanha.id),
    listarTiposDeEntidade(campanha.id),
  ]);

  async function salvar(content: Parameters<typeof salvarDocumentoAction>[1]) {
    'use server';
    return salvarDocumentoAction(entidade.id, content);
  }

  async function criarMencionada(entrada: Parameters<typeof criarEntidadeMencionadaAction>[1]) {
    'use server';
    return criarEntidadeMencionadaAction(campanha.slug, entrada);
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <Link href={`/c/${campanha.slug}`} className="text-muted-foreground text-sm hover:underline">
        {campanha.name}
      </Link>
      <h1 className="mt-1 mb-1 text-2xl font-semibold tracking-tight">{entidade.name}</h1>
      <p className="text-muted-foreground mb-6 text-xs">{entidade.typeKey}</p>

      <Editor
        entityId={entidade.id}
        conteudo={entidade.content}
        salvoEm={entidade.updatedAt.toISOString()}
        salvar={salvar}
        mencionaveis={mencionaveis.map(({ id, name, typeKey }) => ({ id, name, typeKey }))}
        tipos={tipos}
        criarMencionada={criarMencionada}
      />
    </main>
  );
}
