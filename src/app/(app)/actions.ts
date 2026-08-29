'use server';

import { redirect } from 'next/navigation';

import { exigirUsuario } from '@/auth';
import { criarCampanha } from '@/domain/campaigns';

export async function criarCampanhaAction(_estado: string | null, dados: FormData) {
  const usuario = await exigirUsuario();

  const name = String(dados.get('name') ?? '').trim();
  if (!name) return 'Dê um nome à campanha.';

  const campanha = await criarCampanha({
    ownerId: usuario.id,
    name,
    system: String(dados.get('system') ?? ''),
  });
  redirect(`/c/${campanha.slug}`);
}
