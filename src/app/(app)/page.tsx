import Link from 'next/link';

import { exigirUsuario } from '@/auth';
import { listarCampanhas } from '@/domain/campaigns';

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
        <p className="text-muted-foreground text-sm">
          Nenhuma campanha ainda. Crie a primeira e comece a escrever.
        </p>
      ) : (
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
      )}
    </main>
  );
}
