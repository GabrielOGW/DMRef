'use client';

import { useEffect, useRef, useState } from 'react';

import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import type { TiptapDoc } from '@/db/schema';

import type { ItemMencionavel, TipoDeEntidade } from './ListaDeMencao.tsx';
import { criarExtensaoDeMencao, type Mencionaveis } from './mention.ts';
import { guardarRascunho, lerRascunho, limparRascunho } from './rascunho.ts';

const ESPERA_MS = 1500;

type Estado = 'limpo' | 'digitando' | 'salvando' | 'salvo' | 'erro';

export function Editor({
  entityId,
  conteudo,
  salvoEm,
  salvar,
  mencionaveis,
  tipos,
  criarMencionada,
}: {
  entityId: string;
  conteudo: TiptapDoc | null;
  /** `updatedAt` do servidor. Só marca a versão — nunca é comparado com o relógio local. */
  salvoEm: string | null;
  salvar: (doc: TiptapDoc) => Promise<string>;
  /** Campanha inteira, carregada de uma vez: o `@` filtra em memória. */
  mencionaveis: ItemMencionavel[];
  tipos: TipoDeEntidade[];
  criarMencionada: (entrada: ItemMencionavel) => Promise<void>;
}) {
  const base = useRef(salvoEm);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendente = useRef<TiptapDoc | null>(null);
  const [estado, setEstado] = useState<Estado>('limpo');
  const [recuperado, setRecuperado] = useState(false);

  // Caixa mutável, criada uma vez: uma entidade nascida do `@` precisa ser
  // encontrável na frase seguinte, antes de qualquer recarga. É `useState` e não
  // `useRef` porque o valor é lido pelo Tiptap, não pela renderização.
  const [mencoes] = useState<Mencionaveis>(() => ({
    itens: [...mencionaveis],
    tipos,
    aoCriar: (entrada) => {
      // ponytail: sem fila de repetição. Se o INSERT falhar, o nó fica apontando
      // para um id que não existe e o salvamento seguinte acusa — dá para trocar
      // por uma fila quando alguém escrever offline de verdade.
      void criarMencionada(entrada).catch(() => setEstado('erro'));
    },
  }));

  async function gravar() {
    const doc = pendente.current;
    if (!doc) return;
    pendente.current = null;
    setEstado('salvando');
    try {
      base.current = await salvar(doc);
      limparRascunho(entityId);
      setEstado('salvo');
      setRecuperado(false);
    } catch {
      // O rascunho continua no localStorage — é justamente para isto que ele existe.
      setEstado('erro');
    }
  }

  const editor = useEditor({
    // Sem isto o Tiptap renderiza no servidor e a hidratação quebra.
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Escreva. A estrutura vem depois.' }),
      criarExtensaoDeMencao(() => mencoes),
    ],
    content: conteudo ?? undefined,
    editorProps: {
      attributes: { class: 'prose-grimorio min-h-[60vh] outline-none' },
    },
    onUpdate({ editor }) {
      // Uma volta pelo JSON não é paranoia: os `attrs` que o ProseMirror devolve
      // são objetos sem protótipo (`Object.create(null)`), e o serializador das
      // Server Actions os descarta **em silêncio** — a menção chegava no banco
      // como `{ type: 'mention' }`, sem id nem label, e voltava do F5 como `@null`.
      const doc = JSON.parse(JSON.stringify(editor.getJSON())) as TiptapDoc;
      // Snapshot primeiro, síncrono: se a aba fechar no próximo caractere, já foi.
      guardarRascunho(entityId, doc, base.current);
      pendente.current = doc;
      setEstado('digitando');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(gravar, ESPERA_MS);
    },
  });

  // A recuperação é efeito, não render: ler o localStorage durante a renderização
  // dá um resultado no servidor (vazio) e outro no cliente, e a hidratação quebra.
  useEffect(() => {
    if (!editor) return;
    const rascunho = lerRascunho(entityId, base.current);
    if (!rascunho) return;
    editor.commands.setContent(rascunho, { emitUpdate: false });
    pendente.current = rascunho;
    setRecuperado(true);
  }, [editor, entityId]);

  // Desmontou com alteração pendente (navegou para outra página): grava agora.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void gravar();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <p className="text-muted-foreground mb-4 h-4 text-xs">
        {recuperado ? 'Rascunho local recuperado. ' : null}
        {estado === 'salvando' ? 'Salvando…' : null}
        {estado === 'salvo' ? 'Salvo' : null}
        {estado === 'erro' ? 'Não consegui salvar — o texto está guardado neste navegador.' : null}
      </p>
      <EditorContent editor={editor} />
    </>
  );
}
