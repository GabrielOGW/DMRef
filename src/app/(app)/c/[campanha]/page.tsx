import Link from 'next/link';
import { notFound } from 'next/navigation';

import { exigirUsuario } from '@/auth';
import { buscarCampanha } from '@/domain/campaigns';
import { listarEntidades } from '@/domain/entities';

import { NovaPagina } from './nova-pagina.tsx';

export default async function Campanha({ params }: PageProps<'/c/[campanha]'>) {
  const usuario = await exigirUsuario();
  const { campanha: slug } = await params;

  // Escopo por dono na consulta, não no render: um slug de outra pessoa é 404.
  const campanha = await buscarCampanha(usuario.id, slug);
  if (!campanha) notFound();

  const paginas = await listarEntidades(campanha.id);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{campanha.name}</h1>
      {campanha.system ? <p className="text-muted-foreground text-sm">{campanha.system}</p> : null}

      <div className="mt-8 mb-6">
        <NovaPagina campanha={campanha.slug} />
      </div>

      {paginas.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nenhuma página ainda. Crie uma e comece a escrever.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {paginas.map((pagina) => (
            <li key={pagina.id}>
              <Link
                href={`/c/${campanha.slug}/e/${pagina.slug}`}
                className="hover:bg-muted/50 flex items-baseline gap-2 px-4 py-3"
              >
                <span className="font-medium">{pagina.name}</span>
                <span className="text-muted-foreground text-xs">{pagina.typeKey}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
