import { obterAuth } from '@/auth';

// Callback do OAuth e endpoints do Better Auth. É Route Handler, não Server Action:
// quem chama é o GitHub, não o nosso formulário. O `obterAuth()` fica dentro do
// handler de propósito — no topo do módulo, ele voltaria a rodar durante o build.
export const GET = (requisicao: Request) => obterAuth().handler(requisicao);
export const POST = (requisicao: Request) => obterAuth().handler(requisicao);
