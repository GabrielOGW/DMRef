'use client';

import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import { criarCampanhaAction } from './actions.ts';

export function NovaCampanha() {
  const [aberto, setAberto] = useState(false);
  const [erro, agir, enviando] = useActionState(criarCampanhaAction, null);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button>Nova campanha</Button>} />
      <DialogContent>
        <form action={agir} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nova campanha</DialogTitle>
            <DialogDescription>
              Só o nome é obrigatório. O resto se descobre escrevendo.
            </DialogDescription>
          </DialogHeader>
          <Input name="name" placeholder="Sombras de Valoria" autoFocus required />
          <Input name="system" placeholder="Sistema (D&D 5e, Fate…) — opcional" />
          {erro ? <p className="text-destructive text-sm">{erro}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={enviando}>
              {enviando ? 'Criando…' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
