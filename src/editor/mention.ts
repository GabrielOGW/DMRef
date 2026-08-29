import { Mention } from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { uuidv7 } from 'uuidv7';

import {
  type Escolha,
  type ItemMencionavel,
  ListaDeMencao,
  type ListaHandle,
  type TipoDeEntidade,
} from './ListaDeMencao.tsx';

const MAXIMO = 8;

export type Mencionaveis = {
  /** Cache local da campanha inteira: filtrar em memória é o que mantém o popover instantâneo. */
  itens: ItemMencionavel[];
  tipos: TipoDeEntidade[];
  /** Dispara o INSERT em segundo plano. O nó já entrou com o id definitivo. */
  aoCriar: (entrada: ItemMencionavel) => void;
};

/**
 * A menção guarda o **id** da entidade, nunca o nome (invariante 1) — `label` é
 * cache de exibição, e renomear a entidade continua sendo um UPDATE de uma linha.
 *
 * A extensão da biblioteca acrescenta um terceiro atributo (`mentionSuggestionChar`)
 * ao documento. Ele é removido aqui para o JSON gravado ser exatamente
 * `{ id, label }`, que é a forma que o extract.ts do PR 5 vai percorrer.
 */
export function criarExtensaoDeMencao(fonte: () => Mencionaveis) {
  return Mention.extend({
    // Declarados à mão, não herdados: a extensão traz um terceiro atributo
    // (`mentionSuggestionChar`) e herdar via `this.parent()` deixava o nó sem
    // atributo nenhum no `getJSON()` — a menção voltava do banco como `@null`.
    addAttributes() {
      return {
        id: {
          default: null,
          parseHTML: (el: HTMLElement) => el.getAttribute('data-id'),
          renderHTML: (attrs: Record<string, unknown>) =>
            attrs.id ? { 'data-id': attrs.id } : {},
        },
        label: {
          default: null,
          parseHTML: (el: HTMLElement) => el.getAttribute('data-label'),
          renderHTML: (attrs: Record<string, unknown>) =>
            attrs.label ? { 'data-label': attrs.label } : {},
        },
      };
    },
    renderText({ node }) {
      return `@${node.attrs.label ?? node.attrs.id}`;
    },
    renderHTML({ node, HTMLAttributes }) {
      return [
        'span',
        { ...HTMLAttributes, 'data-type': 'mention' },
        `@${node.attrs.label ?? node.attrs.id}`,
      ];
    },
  }).configure({
    suggestion: montarSugestao(fonte),
  });
}

function montarSugestao(fonte: () => Mencionaveis): Omit<SuggestionOptions, 'editor'> {
  return {
    char: '@',

    items: ({ query }) => {
      const alvo = query.trim().toLowerCase();
      const { itens } = fonte();
      if (!alvo) return itens.slice(0, MAXIMO);
      // Filtro local, sem rede: uma campanha tem centenas de entidades, não milhares.
      return itens.filter((i) => i.name.toLowerCase().includes(alvo)).slice(0, MAXIMO);
    },

    command: ({ editor, range, props }) => {
      const escolha = props as unknown as Escolha;
      const atributos = escolha.novo
        ? nascerAgora(escolha.nome, escolha.typeKey, fonte())
        : { id: escolha.id, label: escolha.label };

      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          { type: 'mention', attrs: atributos },
          { type: 'text', text: ' ' },
        ])
        .run();
    },

    render: () => {
      let renderer: ReactRenderer<ListaHandle> | null = null;
      let desmontar: (() => void) | null = null;

      return {
        onStart: (props) => {
          renderer = new ReactRenderer(ListaDeMencao, {
            editor: props.editor,
            props: { ...props, tipos: fonte().tipos },
          });
          // O próprio plugin posiciona o elemento (floating-ui embutido) — sem tippy.
          desmontar = props.mount(renderer.element);
        },
        onUpdate: (props) => {
          renderer?.updateProps({ ...props, tipos: fonte().tipos });
        },
        onKeyDown: (props) => {
          if (props.event.key === 'Escape') return false;
          return renderer?.ref?.onKeyDown(props) ?? false;
        },
        onExit: () => {
          desmontar?.();
          renderer?.destroy();
          desmontar = null;
          renderer = null;
        },
      };
    },
  };
}

/**
 * O truque que faz a criação ser instantânea: o id é um UUIDv7 gerado aqui, o nó
 * entra com ele na hora, e o INSERT vai em segundo plano (ARQUITETURA.md §6.1).
 */
function nascerAgora(nome: string, typeKey: string, fonte: Mencionaveis) {
  const entrada: ItemMencionavel = { id: uuidv7(), name: nome, typeKey };
  // Entra no cache antes do servidor confirmar: mencionar de novo na mesma frase
  // tem que achar a entidade recém-criada.
  fonte.itens.unshift(entrada);
  fonte.aoCriar(entrada);
  return { id: entrada.id, label: entrada.name };
}
