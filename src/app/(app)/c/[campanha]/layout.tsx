import { notFound } from 'next/navigation';

import { exigirUsuario } from '@/auth';
import { buscarCampanha } from '@/domain/campaigns';
import { contarPorTipo } from '@/domain/tipos';

import { BarraLateral } from './barra-lateral.tsx';
import { Paleta } from './paleta.tsx';

/** A barra e a paleta vivem aqui para existirem na campanha e em toda página dela. */
export default async function CampanhaLayout({ params, children }: LayoutProps<'/c/[campanha]'>) {
  const usuario = await exigirUsuario();
  const { campanha: slug } = await params;

  const campanha = await buscarCampanha(usuario.id, slug);
  if (!campanha) notFound();

  const categorias = await contarPorTipo(campanha.id);

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <BarraLateral campanha={slug} categorias={categorias} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <Paleta campanha={slug} />
    </div>
  );
}
