import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { editarEntidadeAction } from './actions.ts';

/**
 * `<details>` nativo em vez de dialog: escrever vem primeiro, e o conserto é raro.
 * Zero JS no cliente para isto — o navegador já sabe abrir e fechar uma gaveta.
 */
export function EditarPagina({
  campanha,
  entidade,
  tipos,
}: {
  campanha: string;
  entidade: { id: string; name: string; slug: string; typeKey: string; arquivada: boolean };
  tipos: { key: string; label: string }[];
}) {
  return (
    <details className="text-sm">
      <summary className="text-muted-foreground cursor-pointer select-none">
        Renomear, trocar o tipo ou arquivar
      </summary>

      <form action={editarEntidadeAction} className="mt-3 flex flex-wrap items-center gap-2">
        <input type="hidden" name="campanha" value={campanha} />
        <input type="hidden" name="entityId" value={entidade.id} />
        <input type="hidden" name="slug" value={entidade.slug} />

        <Input name="name" defaultValue={entidade.name} className="max-w-xs" aria-label="Nome" />

        <select
          name="typeKey"
          defaultValue={entidade.typeKey}
          aria-label="Tipo"
          className="border-input bg-input/30 h-8 rounded-lg border px-2 text-sm"
        >
          {tipos.map((tipo) => (
            <option key={tipo.key} value={tipo.key}>
              {tipo.label}
            </option>
          ))}
        </select>

        <Button type="submit" name="acao" value="salvar" size="sm">
          Salvar
        </Button>

        {entidade.arquivada ? (
          <Button type="submit" name="acao" value="desarquivar" size="sm" variant="outline">
            Desarquivar
          </Button>
        ) : (
          <Button type="submit" name="acao" value="arquivar" size="sm" variant="ghost">
            Arquivar
          </Button>
        )}
      </form>

      <p className="text-muted-foreground mt-2 text-xs">
        Renomear não muda o endereço da página, e as menções em outros textos passam a mostrar o
        nome novo. Arquivar não apaga: some das listas e da busca, e a página continua aqui pela
        URL.
      </p>
    </details>
  );
}
