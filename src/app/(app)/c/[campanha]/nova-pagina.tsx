'use client';

import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { criarEntidadeAction } from './actions.ts';

export function NovaPagina({ campanha }: { campanha: string }) {
  const [erro, agir, enviando] = useActionState(criarEntidadeAction, null);

  return (
    <form action={agir} className="flex items-center gap-2">
      <input type="hidden" name="campanha" value={campanha} />
      <Input name="name" placeholder="Nova página…" required className="max-w-xs" />
      <Button type="submit" disabled={enviando}>
        Criar
      </Button>
      {erro ? <span className="text-destructive text-sm">{erro}</span> : null}
    </form>
  );
}
