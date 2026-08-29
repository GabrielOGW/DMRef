import { Paleta } from './paleta.tsx';

/** A paleta vive aqui para estar disponível na campanha e em toda página dela. */
export default async function CampanhaLayout({ params, children }: LayoutProps<'/c/[campanha]'>) {
  const { campanha } = await params;
  return (
    <>
      {children}
      <Paleta campanha={campanha} />
    </>
  );
}
