'use client';

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

import type { SuggestionKeyDownProps } from '@tiptap/suggestion';

export type ItemMencionavel = { id: string; name: string; typeKey: string };
export type TipoDeEntidade = { key: string; label: string };

/** O que o popover devolve: uma entidade que já existe, ou uma a nascer. */
export type Escolha =
  | { novo: false; id: string; label: string }
  | { novo: true; nome: string; typeKey: string };

export type ListaHandle = { onKeyDown: (props: SuggestionKeyDownProps) => boolean };

type Props = {
  items: ItemMencionavel[];
  query: string;
  tipos: TipoDeEntidade[];
  command: (escolha: Escolha) => void;
};

export const ListaDeMencao = forwardRef<ListaHandle, Props>(function ListaDeMencao(
  { items, query, tipos, command },
  ref,
) {
  // A última seção é "Criar «X» como…". Só aparece com algo digitado — `@` sozinho
  // é para encontrar, não para criar.
  const criaveis = query.trim() ? tipos : [];
  const total = items.length + criaveis.length;
  const [ativo, setAtivo] = useState(0);

  useEffect(() => setAtivo(0), [items, query]);

  function escolher(indice: number) {
    if (indice < items.length) {
      const item = items[indice];
      command({ novo: false, id: item.id, label: item.name });
      return;
    }
    const tipo = criaveis[indice - items.length];
    if (tipo) command({ novo: true, nome: query.trim(), typeKey: tipo.key });
  }

  useImperativeHandle(ref, () => ({
    onKeyDown({ event }) {
      if (total === 0) return false;
      if (event.key === 'ArrowUp') {
        setAtivo((i) => (i + total - 1) % total);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setAtivo((i) => (i + 1) % total);
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        escolher(ativo);
        return true;
      }
      return false;
    },
  }));

  if (total === 0) return null;

  return (
    <div className="bg-popover text-popover-foreground max-h-72 w-72 overflow-y-auto rounded-lg border p-1 shadow-md">
      {items.map((item, i) => (
        <button
          key={item.id}
          type="button"
          data-ativo={i === ativo || undefined}
          className="hover:bg-accent data-[ativo]:bg-accent flex w-full items-baseline gap-2 rounded px-2 py-1.5 text-left text-sm"
          onMouseDown={(e) => {
            e.preventDefault();
            escolher(i);
          }}
        >
          <span className="truncate">{item.name}</span>
          <span className="text-muted-foreground ml-auto text-xs">{item.typeKey}</span>
        </button>
      ))}

      {criaveis.length > 0 ? (
        <>
          <p className="text-muted-foreground px-2 pt-2 pb-1 text-xs">
            Criar «{query.trim()}» como…
          </p>
          {criaveis.map((tipo, i) => {
            const indice = items.length + i;
            return (
              <button
                key={tipo.key}
                type="button"
                data-ativo={indice === ativo || undefined}
                className="hover:bg-accent data-[ativo]:bg-accent block w-full truncate rounded px-2 py-1.5 text-left text-sm"
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolher(indice);
                }}
              >
                {tipo.label}
              </button>
            );
          })}
        </>
      ) : null}
    </div>
  );
});
