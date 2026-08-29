'use client';

import { useEffect, useRef, useState } from 'react';

import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import type { TiptapDoc } from '@/db/schema';

import { guardarRascunho, lerRascunho, limparRascunho } from './rascunho.ts';

const ESPERA_MS = 1500;

type Estado = 'limpo' | 'digitando' | 'salvando' | 'salvo' | 'erro';

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
  const [recuperado, setRecuperado] = useState(false);

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
    ],
    content: conteudo ?? undefined,
    editorProps: {
      attributes: { class: 'prose-grimorio min-h-[60vh] outline-none' },
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
