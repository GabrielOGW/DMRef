'use client';

import { useEffect, useRef, useState } from 'react';

import { Placeholder } from '@tiptap/extension-placeholder';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import type { TiptapDoc } from '@/db/schema';

import { guardarRascunho, limparRascunho, lerRascunho } from './rascunho.ts';

const ESPERA_MS = 1500;

type Estado = 'limpo' | 'digitando' | 'salvando' | 'erro';

export function Editor({
  entityId,
  conteudo,
  salvoEm,
  salvar,
}: {
  entityId: string;
  conteudo: TiptapDoc | null;
  /** `updatedAt` do servidor. Só marca a versão — nunca é comparado com o relógio local. */
  salvoEm: string | null;
  salvar: (doc: TiptapDoc) => Promise<string>;
}) {
  const base = useRef(salvoEm);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendente = useRef<TiptapDoc | null>(null);
  const [estado, setEstado] = useState<Estado>('limpo');

  // Só na primeira renderização: depois disso quem manda no documento é o Tiptap.
  const [rascunho] = useState(() => lerRascunho(entityId, salvoEm));
  const [recuperado, setRecuperado] = useState(rascunho !== null);

  async function gravar() {
    const doc = pendente.current;
    if (!doc) return;
    pendente.current = null;
    setEstado('salvando');
    try {
      base.current = await salvar(doc);
      limparRascunho(entityId);
      setEstado('limpo');
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
    ],
    content: rascunho ?? conteudo ?? undefined,
    editorProps: {
      attributes: {
        class: 'prose-grimorio min-h-[60vh] outline-none',
      },
    },
    onUpdate({ editor }) {
      const doc = editor.getJSON() as TiptapDoc;
      // Snapshot primeiro, síncrono: se a aba fechar no próximo caractere, já foi.
      guardarRascunho(entityId, doc, base.current);
      pendente.current = doc;
      setEstado('digitando');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(gravar, ESPERA_MS);
    },
  });

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
        {estado === 'erro' ? 'Não consegui salvar — o texto está guardado neste navegador.' : null}
      </p>
      <EditorContent editor={editor} />
    </>
  );
}
