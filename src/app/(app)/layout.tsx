import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { exigirUsuario, obterAuth } from '@/auth';
import { Button } from '@/components/ui/button';

async function sair() {
  'use server';
  await obterAuth().api.signOut({ headers: await headers() });
  redirect('/entrar');
}

// O gate de autenticação do grupo (app). Cada action revalida por conta própria —
// layout não é fronteira de segurança, é conveniência de UI.
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const usuario = await exigirUsuario();

  return (
    <>
      <header className="flex items-center gap-4 border-b px-6 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          Grimório
        </Link>
        <span className="text-muted-foreground ml-auto text-sm">{usuario.name}</span>
        <form action={sair}>
          <Button type="submit" variant="ghost" size="sm">
            Sair
          </Button>
        </form>
      </header>
      {children}
    </>
  );
}
