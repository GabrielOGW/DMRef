import { toNextJsHandler } from 'better-auth/next-js';

import { auth } from '@/auth';

// Callback do OAuth e endpoints do Better Auth. É Route Handler, não Server Action:
// quem chama é o GitHub, não o nosso formulário.
export const { GET, POST } = toNextJsHandler(auth);
