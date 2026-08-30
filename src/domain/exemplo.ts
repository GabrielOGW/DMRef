import type { TiptapDoc } from '@/db/schema';

import { slugify } from './slug.ts';

/**
 * A campanha de exemplo é o tutorial do Grimório — e ela ensina do único jeito
 * que não contradiz o produto: sendo conteúdo. Não há passo a passo por cima da
 * tela, não há balão para dispensar, não há estado de "já viu". São seis páginas
 * escritas, que se explicam quando lidas e viram descartáveis quando não.
 *
 * O motivo é o invariante 4: nada bloqueia a escrita. Um tour modal bloquearia.
 *
 * Ela nasce em campanha **própria**, e isso importa para além da arrumação: a
 * pergunta 2 da Fase 0 se responde contando páginas de corpo vazio na lista da
 * campanha (docs/FASE-0.md). Semear páginas na campanha real sujaria a medição.
 *
 * Este arquivo é só o texto, e é puro pelo mesmo motivo do `editor/extract.ts`:
 * quem grava mora em `campaigns.ts`, que importa `@/db`. Misturar os dois faria
 * o teste do conteúdo exigir credencial de banco para ler uma string.
 */

export const SLUG_DA_CAMPANHA = 'comece-aqui';
export const NOME_DA_CAMPANHA = 'Comece aqui';

// ── as páginas ──────────────────────────────────────────────────────────────

const PAGINAS = {
  comecar: { name: 'Comece aqui', typeKey: 'nota' },
  // O nome sai igual ao que `criarSessao` produziria: o exemplo tem que parecer
  // com o que o app faz, não com uma versão de brochura dele.
  sessao: { name: 'Sessão 01', typeKey: 'sessao' },
  thalia: { name: 'Thalia', typeKey: 'pj' },
  bran: { name: 'Bran', typeKey: 'npc' },
  morgana: { name: 'Lady Morgana', typeKey: 'npc' },
  pedravil: { name: 'Pedravil', typeKey: 'local' },
} as const satisfies Record<string, { name: string; typeKey: string }>;

type Papel = keyof typeof PAGINAS;

/** Onde o usuário cai ao abrir o exemplo — a página de entrada do elenco. */
export const SLUG_DA_ENTRADA = slugify(PAGINAS.comecar.name);

export type PaginaDeExemplo = {
  papel: Papel;
  id: string;
  name: string;
  slug: string;
  typeKey: string;
  content: TiptapDoc;
  /** Presente só na sessão: vira a linha da extensão 1:1 `sessions`. */
  numeroDaSessao?: number;
};

// ── construtores do documento do Tiptap ─────────────────────────────────────
// Escrever `{ type: 'paragraph', content: [...] }` à mão dezenas de vezes esconde
// o texto no meio da estrutura. Estes deixam o conteúdo legível, que é o que se
// vai reler no dia em que o tutorial estiver errado.

type No = Record<string, unknown>;

const texto = (t: string): No => ({ type: 'text', text: t });
const forte = (t: string): No => ({ type: 'text', text: t, marks: [{ type: 'bold' }] });
const codigo = (t: string): No => ({ type: 'text', text: t, marks: [{ type: 'code' }] });
const p = (...filhos: No[]): No =>
  filhos.length ? { type: 'paragraph', content: filhos } : { type: 'paragraph' };
const h2 = (t: string): No => ({ type: 'heading', attrs: { level: 2 }, content: [texto(t)] });
const citacao = (...filhos: No[]): No => ({ type: 'blockquote', content: [p(...filhos)] });
const lista = (...itens: No[][]): No => ({
  type: 'bulletList',
  content: itens.map((filhos) => ({ type: 'listItem', content: [p(...filhos)] })),
});
const doc = (...filhos: No[]) => ({ type: 'doc', content: filhos }) as TiptapDoc;

/**
 * Puro de propósito: os ids nascem aqui, os corpos referenciam esses ids, e o
 * teste confere que nenhuma menção aponta para fora do elenco sem encostar no
 * banco. Menção com id errado é justamente o defeito que passaria despercebido —
 * ela é descartada em silêncio na gravação (ver domain/documents.ts).
 */
export function montarExemplo(): PaginaDeExemplo[] {
  const papeis = Object.keys(PAGINAS) as Papel[];
  const ids = Object.fromEntries(papeis.map((papel) => [papel, crypto.randomUUID()])) as Record<
    Papel,
    string
  >;

  /** Menção pelo papel: o id é o que vale, o rótulo é cache de exibição. */
  const em = (papel: Papel): No => ({
    type: 'mention',
    attrs: { id: ids[papel], label: PAGINAS[papel].name },
  });

  const corpos: Record<Papel, TiptapDoc> = {
    comecar: doc(
      p(
        texto(
          'Esta campanha é um exemplo, e ela é o tutorial: não existe passo a passo para dispensar, só páginas para ler e mexer. Apague, renomeie, reescreva à vontade. A sua campanha de verdade é outra, e as duas não se misturam.',
        ),
      ),

      h2('O que o Grimório faz'),
      p(
        texto('Você escreve a sessão. Ele descobre o resto — quem apareceu, onde, e em que noite.'),
      ),
      p(
        texto('Abra a '),
        em('sessao'),
        texto(' pela barra lateral, em “Sessões”, e leia os três primeiros parágrafos. Depois abra a '),
        em('morgana'),
        texto(' em “NPCs” e role até o fim da página: tem uma seção lá que ninguém digitou.'),
      ),

      h2('As quatro coisas que valem aprender'),
      lista(
        [
          forte('Escrever.'),
          texto(' É só começar a digitar. Nada é obrigatório e nenhum formulário abre.'),
        ],
        [
          forte('O @.'),
          texto(
            ' No meio da frase, menciona quem já existe — ou cria na hora quem ainda não existe.',
          ),
        ],
        [
          forte('O Ctrl+K.'),
          texto(' Vai para qualquer página pelo nome, mesmo digitado pela metade ou errado.'),
        ],
        [
          forte('O “Onde aparece”.'),
          texto(
            ' No fim de cada página: todos os lugares em que aquela entidade foi citada, na ordem das sessões. Cada linha dali é um link de volta para a cena.',
          ),
        ],
      ),

      h2('Quando quiser começar de verdade'),
      p(
        texto(
          'Volte para a lista de campanhas e crie a sua. Esta aqui pode ficar onde está — ela não atrapalha e não se mistura com a outra.',
        ),
      ),
    ),

    sessao: doc(
      p(
        em('thalia'),
        texto(' chegou em '),
        em('pedravil'),
        texto(' ao anoitecer, sozinha e com a bota furada.'),
      ),
      p(
        em('bran'),
        texto(', que toca a estalagem, contou por três moedas que '),
        em('morgana'),
        texto(
          ' dormiu aqui há três noites — e foi embora antes do sol, sem pagar e sem dizer para onde.',
        ),
      ),
      p(texto('Ninguém mais na aldeia quis falar dela depois disso.')),

      citacao(
        texto('Cada @ acima é uma página de verdade. Chega-se nelas pela barra lateral ou pelo '),
        codigo('Ctrl+K'),
        texto(' — o @ no texto marca a entidade, não navega até ela. Abra a '),
        // De propósito sem chip: este aviso não é ficção, e menção aqui viraria
        // uma segunda linha no "Histórico" da Morgana, embaçando a lição de lá.
        forte('Lady Morgana'),
        texto(' em “NPCs” e veja o que esta cena escreveu lá dentro, sozinha.'),
      ),

      h2('Agora tente você'),
      p(
        texto('Escreva um '),
        codigo('@'),
        texto(
          ' na linha vazia aqui embaixo, com um nome que ainda não existe nesta campanha, e escolha uma categoria na lista que aparecer. A página nasce enquanto você digita: sem sair daqui, sem salvar, sem preencher nada.',
        ),
      ),
      // Linha vazia no fim, e o editor abre com o cursor no fim: quem chega aqui
      // já está com o cursor exatamente onde o parágrafo acima manda escrever.
      p(),
    ),

    morgana: doc(
      p(
        texto('Esta página não foi criada num formulário. Ela nasceu de um '),
        codigo('@'),
        texto(' no meio de uma frase da '),
        em('sessao'),
        texto(', enquanto alguém narrava.'),
      ),

      h2('Role até o fim desta página'),
      p(
        texto('Tem uma seção '),
        forte('Histórico'),
        texto(' lá embaixo, com uma linha que você não escreveu. Ela apareceu sozinha porque a '),
        em('sessao'),
        texto(
          ' citou a Morgana, e o trecho mostrado ali é o texto ao redor da menção, congelado no momento em que a sessão foi salva. O nome no começo daquela linha é um link: é assim que se volta da entidade para a cena em que ela apareceu.',
        ),
      ),
      p(
        texto(
          'Ela está sob “Histórico”, e não sob “Aparece em”, porque veio de uma sessão numerada. O que vem de sessão sai na ordem da ficção; menção vinda de nota ou de outra página fica na lista de baixo.',
        ),
      ),

      h2('E daqui em diante'),
      p(
        texto(
          'Escreva o que quiser sobre ela neste corpo. É uma página como qualquer outra — o que a torna “uma NPC” é só a categoria, e categoria se troca.',
        ),
      ),
    ),

    bran: doc(
      p(
        forte('Renomeie esta página.'),
        texto(
          ' Sério: abra o “Renomear, trocar o tipo ou arquivar” logo abaixo do título, troque “Bran” por outro nome e salve.',
        ),
      ),
      p(
        texto('Nada quebra. A frase da '),
        em('sessao'),
        texto(
          ' passa a mostrar o nome novo sozinha, porque a menção guarda a identidade do Bran e não o texto dele. Trocar o nome de um NPC no meio da campanha custa um clique, e não uma caçada por todas as menções antigas.',
        ),
      ),

      h2('No mesmo lugar'),
      p(
        texto(
          'Você também troca a categoria — de NPC para PJ, no dia em que alguém resolver jogar com ele — e arquiva a página. Arquivar tira das listas sem apagar: as menções já escritas continuam de pé, apontando para uma página que ainda existe.',
        ),
      ),
    ),

    pedravil: doc(
      p(
        texto('Olhe a barra lateral. Esta página está em '),
        forte('Locais'),
        texto('; a '),
        em('morgana'),
        texto(' e o '),
        em('bran'),
        texto(' estão em '),
        forte('NPCs'),
        texto('; a '),
        em('thalia'),
        texto(' está em '),
        forte('PJs'),
        texto('.'),
      ),

      h2('As categorias são suas'),
      p(
        texto(
          'Elas são dados, não um menu fixo. Dá para criar “Facção”, “Presságio”, “Taverna” — o que a sua mesa realmente usar — ali no fim da barra lateral, e nada no sistema precisa mudar para isso.',
        ),
      ),

      h2('Quando a barra lateral não bastar'),
      p(
        texto('Aperte '),
        codigo('Ctrl+K'),
        texto(
          ' e digite “morg”. A Lady Morgana aparece sem você escrever o nome inteiro, e apareceria também se você tivesse digitado “mrogana”. É assim que se anda por uma campanha grande no meio de uma sessão, sem perder o fio.',
        ),
      ),
    ),

    thalia: doc(
      p(
        texto(
          'A Thalia é a personagem jogável de exemplo. A página dela é igual às outras: o que muda é a categoria, e nada mais.',
        ),
      ),

      h2('Não existe ficha aqui'),
      p(
        texto(
          'É de propósito. O Grimório é a memória da campanha — o que aconteceu, com quem, em que noite —, não a planilha do personagem. Pontos de vida moram na ficha que a sua mesa já usa.',
        ),
      ),

      h2('O contrato do sistema'),
      p(
        texto(
          'Uma página válida precisa de duas coisas: um nome e uma categoria. Todo o resto é opcional, hoje e depois. Nada vai bloquear você no meio de uma frase para pedir um campo.',
        ),
      ),
    ),
  };

  return papeis.map((papel) => ({
    papel,
    id: ids[papel],
    name: PAGINAS[papel].name,
    slug: slugify(PAGINAS[papel].name),
    typeKey: PAGINAS[papel].typeKey,
    content: corpos[papel],
    ...(papel === 'sessao' ? { numeroDaSessao: 1 } : {}),
  }));
}
