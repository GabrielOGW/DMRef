import { redirect } from 'next/navigation';

import { obterAuth, sessaoAtual } from '@/auth';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Entrar · Grimório' };

async function entrarComGithub() {
  'use server';
  const { url } = await obterAuth().api.signInSocial({
    body: { provider: 'github', callbackURL: '/' },
  });
  // Sem `url` só se o provedor estiver mal configurado — falhar alto é melhor
  // que um botão que não faz nada.
  if (!url) throw new Error('GitHub não devolveu URL de autorização');
  redirect(url);
}

export default async function Entrar() {
  if (await sessaoAtual()) redirect('/');

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-24">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Grimório</h1>
        <p className="text-muted-foreground text-sm">
          Wiki viva de campanhas de RPG. Entre para abrir as suas.
        </p>
      </div>
      <form action={entrarComGithub}>
        <Button type="submit" className="w-full">
          Entrar com GitHub
        </Button>
      </form>
    </main>
  );
}
