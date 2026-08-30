import Link from 'next/link';

import { exigirUsuario } from '@/auth';
import { Button } from '@/components/ui/button';
import { listarCampanhas } from '@/domain/campaigns';

import { abrirCampanhaDeExemploAction } from './actions.ts';
import { NovaCampanha } from './nova-campanha.tsx';

export default async function Campanhas() {
  const usuario = await exigirUsuario();
  const campanhas = await listarCampanhas(usuario.id);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Campanhas</h1>
        <NovaCampanha />
      </div>

      {campanhas.length === 0 ? (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Nenhuma campanha ainda. Crie a sua — ou abra a de exemplo, que é o tutorial do Grimório
            e se explica sendo lida.
          </p>
          <AbrirExemplo destaque />
        </div>
      ) : (
        <>
          <ul className="divide-y rounded-lg border">
            {campanhas.map((campanha) => (
              <li key={campanha.id}>
                <Link href={`/c/${campanha.slug}`} className="hover:bg-muted/50 block px-4 py-3">
                  <span className="font-medium">{campanha.name}</span>
                  {campanha.system ? (
                    <span className="text-muted-foreground ml-2 text-sm">{campanha.system}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <AbrirExemplo />
          </div>
        </>
      )}
    </main>
  );
}

/**
 * Abre o tutorial. Diz "abrir" e não "criar" porque a ação é idempotente: na
 * segunda vez ela reabre a campanha que já existe, em vez de fazer outra.
 */
function AbrirExemplo({ destaque = false }: { destaque?: boolean }) {
  return (
    <form action={abrirCampanhaDeExemploAction}>
      <Button
        type="submit"
        variant={destaque ? 'outline' : 'link'}
        className={destaque ? undefined : 'text-muted-foreground px-0'}
      >
        Abrir a campanha de exemplo
      </Button>
    </form>
  );
}
