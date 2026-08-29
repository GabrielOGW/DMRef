'use client';

import Link from 'next/link';
import { useSelectedLayoutSegments } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { criarCategoriaAction } from './actions.ts';

export type Categoria = {
  key: string;
  plural: string;
  proprio: boolean;
  quantas: number;
};

/**
 * Categorias fixas: aparecem sempre, mesmo vazias, porque uma barra que muda de
 * tamanho conforme o que já foi escrito não serve para navegar — e porque estas
 * são as gavetas que uma campanha tem antes de existir.
 *
 * É ordem de exibição, não definição de tipo: acrescentar um tipo continua sendo
 * um `INSERT`, sem migração e sem tocar em código (invariante 5).
 */
const FIXAS = ['sessao', 'pj', 'npc', 'local', 'evento', 'nota'];

export function BarraLateral({
  campanha,
  categorias,
}: {
  campanha: string;
  categorias: Categoria[];
}) {
  // Cliente só por isto: destacar onde você está exige saber a rota.
  const segmentos = useSelectedLayoutSegments();
  const ativo = segmentos[0] === 't' ? segmentos[1] : undefined;

  const fixas = FIXAS.map((key) => categorias.find((c) => c.key === key)).filter(
    (c) => c !== undefined,
  );
  // As demais só aparecem quando existem de verdade: criadas pela campanha, ou com
  // alguma página dentro. Dezessete gavetas vazias não é navegação, é ruído.
  const demais = categorias.filter((c) => !FIXAS.includes(c.key) && (c.quantas > 0 || c.proprio));

  return (
    <aside className="flex shrink-0 gap-1 overflow-x-auto border-b p-3 md:w-56 md:flex-col md:overflow-visible md:border-r md:border-b-0">
      {[...fixas, ...demais].map((categoria) => (
        <Link
          key={categoria.key}
          href={`/c/${campanha}/t/${categoria.key}`}
          data-ativo={categoria.key === ativo || undefined}
          aria-current={categoria.key === ativo ? 'page' : undefined}
          className="hover:bg-muted data-[ativo]:bg-muted flex shrink-0 items-baseline gap-2 rounded-lg px-2.5 py-1.5 text-sm"
        >
          <span className="whitespace-nowrap">{categoria.plural}</span>
          {categoria.quantas > 0 ? (
            <span className="text-muted-foreground ml-auto text-xs">{categoria.quantas}</span>
          ) : null}
        </Link>
      ))}

      <form action={criarCategoriaAction} className="mt-2 hidden gap-1 md:flex">
        <input type="hidden" name="campanha" value={campanha} />
        <Input name="nome" placeholder="Nova categoria…" required className="h-7 text-xs" />
        <Button type="submit" size="icon-sm" variant="ghost" aria-label="Criar categoria">
          +
        </Button>
      </form>
    </aside>
  );
}
