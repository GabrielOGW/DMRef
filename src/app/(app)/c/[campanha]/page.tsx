import Link from 'next/link';
import { notFound } from 'next/navigation';

import { exigirUsuario } from '@/auth';
import { Button } from '@/components/ui/button';
import { buscarCampanha } from '@/domain/campaigns';
import { listarEntidades } from '@/domain/entities';
import { listarSessoes } from '@/domain/sessions';

import { criarSessaoAction } from './actions.ts';
import { NovaPagina } from './nova-pagina.tsx';

export default async function Campanha({ params }: PageProps<'/c/[campanha]'>) {
  const usuario = await exigirUsuario();
  const { campanha: slug } = await params;

  // Escopo por dono na consulta, não no render: um slug de outra pessoa é 404.
  const campanha = await buscarCampanha(usuario.id, slug);
  if (!campanha) notFound();

  const [entidades, sessoes] = await Promise.all([
    listarEntidades(campanha.id),
    listarSessoes(campanha.id),
  ]);
  // Sessões têm seção própria e as categorias moram na barra lateral: aqui a
  // campanha vira o que ela devia ser, uma porta de entrada com o que foi mexido
  // por último. `listarEntidades` já ordena por `updatedAt`.
  const recentes = entidades.filter((e) => e.typeKey !== 'sessao').slice(0, 8);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{campanha.name}</h1>
      {campanha.system ? <p className="text-muted-foreground text-sm">{campanha.system}</p> : null}

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold tracking-tight">Sessões</h2>
          <form action={criarSessaoAction}>
            <input type="hidden" name="campanha" value={campanha.slug} />
            <Button type="submit" size="sm" variant="outline">
              Nova sessão
            </Button>
          </form>
        </div>
        {sessoes.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhuma sessão ainda. A próxima começa com o corpo em foco, para você já escrever.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {sessoes.map((sessao) => (
              <li key={sessao.id}>
                <Link
                  href={`/c/${campanha.slug}/e/${sessao.slug}`}
                  className="hover:bg-muted/50 block rounded-lg border px-3 py-1.5 text-sm"
                >
                  {sessao.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-10 mb-3 flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold tracking-tight">Recentes</h2>
      </div>
      <div className="mb-6">
        <NovaPagina campanha={campanha.slug} />
      </div>

      {recentes.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nenhuma página ainda. Crie uma aqui, ou escreva <code>@nome</code> dentro de uma sessão —
          a página nasce da frase.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {recentes.map((pagina) => (
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
