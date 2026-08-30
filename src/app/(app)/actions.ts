'use server';

import { redirect } from 'next/navigation';

import { exigirUsuario } from '@/auth';
import { criarCampanha, criarCampanhaDeExemplo } from '@/domain/campaigns';
import { SLUG_DA_ENTRADA } from '@/domain/exemplo';

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

/**
 * Abre o tutorial: a campanha de exemplo, criada na primeira vez e reaberta nas
 * seguintes (a criação é idempotente por dono). Cai na página de entrada, não no
 * índice da campanha — quem clicou aqui quer ler, não escolher.
 */
export async function abrirCampanhaDeExemploAction() {
  const usuario = await exigirUsuario();
  const campanha = await criarCampanhaDeExemplo(usuario.id);
  redirect(`/c/${campanha.slug}/e/${SLUG_DA_ENTRADA}`);
}
