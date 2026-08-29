import { exigirUsuario } from '@/auth';
import { buscarCampanha } from '@/domain/campaigns';
import { buscarPorNome } from '@/domain/search';

/**
 * Route Handler, não Server Action: as actions são despachadas uma por vez por
 * cliente, e uma paleta digitando enfileiraria tecla atrás de tecla. Consulta é
 * leitura — o lugar dela é aqui (guia de Server Actions do Next 16).
 */
export async function GET(requisicao: Request) {
  const usuario = await exigirUsuario();
  const { searchParams } = new URL(requisicao.url);

  const campanha = await buscarCampanha(usuario.id, searchParams.get('c') ?? '');
  if (!campanha) return Response.json({ resultados: [] }, { status: 404 });

  const resultados = await buscarPorNome(campanha.id, searchParams.get('q') ?? '');
  return Response.json({ resultados });
}
