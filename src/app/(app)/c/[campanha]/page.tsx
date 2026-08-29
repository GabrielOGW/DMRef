import { notFound } from 'next/navigation';

import { exigirUsuario } from '@/auth';
import { buscarCampanha } from '@/domain/campaigns';

export default async function Campanha({ params }: PageProps<'/c/[campanha]'>) {
  const usuario = await exigirUsuario();
  const { campanha: slug } = await params;

  // Escopo por dono na consulta, não no render: um slug de outra pessoa é 404.
  const campanha = await buscarCampanha(usuario.id, slug);
  if (!campanha) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{campanha.name}</h1>
      {campanha.system ? <p className="text-muted-foreground text-sm">{campanha.system}</p> : null}
      <p className="text-muted-foreground mt-8 text-sm">
        Vazia por enquanto. O editor chega no PR 3 — ver docs/FASE-0.md.
      </p>
    </main>
  );
}
