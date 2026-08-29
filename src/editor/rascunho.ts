import type { TiptapDoc } from '@/db/schema';

/**
 * Snapshot local do que está sendo digitado. É a rede de segurança do risco R2:
 * escrito a cada alteração, apagado só quando o servidor confirma a gravação.
 *
 * `base` é o `updatedAt` que o servidor devolveu quando o editor abriu. Guardar
 * a versão de origem, e não um horário, evita comparar o relógio do navegador
 * com o do Postgres — um browser atrasado descartaria rascunho válido.
 */
type Rascunho = { doc: TiptapDoc; base: string | null };

const chave = (entityId: string) => `grimorio:rascunho:${entityId}`;

// Em aba anônima ou com cookies de terceiros bloqueados o acesso lança.
function armazem(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function guardarRascunho(entityId: string, doc: TiptapDoc, base: string | null) {
  try {
    armazem()?.setItem(chave(entityId), JSON.stringify({ doc, base } satisfies Rascunho));
  } catch {
    // cota estourada: perder o snapshot é ruim, travar a digitação é pior
  }
}

/** Devolve o rascunho só se ele nasceu da mesma versão que o servidor tem agora. */
export function lerRascunho(entityId: string, base: string | null): TiptapDoc | null {
  const bruto = armazem()?.getItem(chave(entityId));
  if (!bruto) return null;
  try {
    const rascunho = JSON.parse(bruto) as Rascunho;
    return rascunho.base === base ? rascunho.doc : null;
  } catch {
    return null; // lixo no storage não é motivo para a página não abrir
  }
}

export function limparRascunho(entityId: string) {
  try {
    armazem()?.removeItem(chave(entityId));
  } catch {
    // idem
  }
}
