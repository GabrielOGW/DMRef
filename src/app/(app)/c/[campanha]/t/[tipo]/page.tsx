import Link from 'next/link';
import { notFound } from 'next/navigation';

import { exigirUsuario } from '@/auth';
import { buscarCampanha } from '@/domain/campaigns';
import { buscarTipo, listarPorTipo } from '@/domain/tipos';

import { NovaPagina } from '../../nova-pagina.tsx';

/** Uma rota para toda categoria: o tipo é dado, não arquivo (ARQUITETURA.md §8). */
export default async function Categoria({ params }: PageProps<'/c/[campanha]/t/[tipo]'>) {
  const usuario = await exigirUsuario();
  const { campanha: campanhaSlug, tipo: typeKey } = await params;

  const campanha = await buscarCampanha(usuario.id, campanhaSlug);
  if (!campanha) notFound();

  const tipo = await buscarTipo(campanha.id, typeKey);
  if (!tipo) notFound();

  const paginas = await listarPorTipo(campanha.id, tipo.key);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <Link href={`/c/${campanha.slug}`} className="text-muted-foreground text-sm hover:underline">
        {campanha.name}
      </Link>
      <h1 className="mt-1 mb-6 text-2xl font-semibold tracking-tight">{tipo.plural}</h1>

      <div className="mb-6">
        <NovaPagina campanha={campanha.slug} typeKey={tipo.key} rotulo={tipo.label} />
      </div>

      {paginas.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nada aqui ainda. Escrever <code>@nome</code> em qualquer texto e escolher {tipo.label}{' '}
          também cria a página, sem sair da frase.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {paginas.map((pagina) => (
            <li key={pagina.id}>
              <Link
                href={`/c/${campanha.slug}/e/${pagina.slug}`}
                className="hover:bg-muted/50 block px-4 py-3 text-sm font-medium"
              >
                {pagina.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
