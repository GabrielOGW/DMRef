import { db } from './index.ts';
import { entityTypes, relationshipTypes } from './schema.ts';

// Tipos globais: campaignId nulo, herdados por toda campanha. São dados, não enum —
// dá para acrescentar um tipo novo com um INSERT, sem migração (ARQUITETURA.md §4.1).
//
// Idempotente: `ON CONFLICT DO NOTHING` apoiado nos índices únicos parciais
// entity_types_global_key_idx e relationship_types_global_key_idx.

const TIPOS_DE_ENTIDADE = [
  // ── mundo ────────────────────────────────────────────────────────────────
  { key: 'pj', label: 'Personagem jogável', plural: 'Personagens jogáveis', icon: 'user-round', color: '#2C7A68' },
  { key: 'npc', label: 'NPC', plural: 'NPCs', icon: 'venetian-mask', color: '#3F7CAC' },
  { key: 'local', label: 'Local', plural: 'Locais', icon: 'map-pin', color: '#7A6A3F' },
  { key: 'cidade', label: 'Cidade', plural: 'Cidades', icon: 'building-2', color: '#7A6A3F' },
  { key: 'regiao', label: 'Região', plural: 'Regiões', icon: 'map', color: '#7A6A3F' },
  { key: 'reino', label: 'Reino', plural: 'Reinos', icon: 'crown', color: '#8A6A2F' },
  { key: 'organizacao', label: 'Organização', plural: 'Organizações', icon: 'landmark', color: '#5F5A8A' },
  { key: 'faccao', label: 'Facção', plural: 'Facções', icon: 'swords', color: '#8A4A4A' },
  { key: 'item', label: 'Item', plural: 'Itens', icon: 'package', color: '#6A6A6A' },
  { key: 'criatura', label: 'Criatura', plural: 'Criaturas', icon: 'paw-print', color: '#4A6A3F' },
  { key: 'missao', label: 'Missão', plural: 'Missões', icon: 'scroll-text', color: '#7A4364' },
  { key: 'nota', label: 'Nota', plural: 'Notas', icon: 'sticky-note', color: '#6A6A6A' },
  { key: 'segredo', label: 'Segredo', plural: 'Segredos', icon: 'eye-off', color: '#7A4364' },

  // ── estrutura narrativa ──────────────────────────────────────────────────
  { key: 'sessao', label: 'Sessão', plural: 'Sessões', icon: 'clapperboard', color: '#2C7A68', isNarrative: true },
  { key: 'ato', label: 'Ato', plural: 'Atos', icon: 'layers', color: '#2C7A68', isNarrative: true },
  { key: 'arco', label: 'Arco', plural: 'Arcos', icon: 'git-branch', color: '#2C7A68', isNarrative: true },
  { key: 'evento', label: 'Evento', plural: 'Eventos', icon: 'zap', color: '#9A5F26', isNarrative: true },
];

// Sempre dirigidas origem → destino. O lado inverso é renderizado a partir de
// `inverse`, nunca gravado como segunda linha (ARQUITETURA.md §4.5).
const TIPOS_DE_RELACAO = [
  { key: 'aliado_de', label: 'aliado de', inverse: 'aliado de', symmetric: true },
  { key: 'inimigo_de', label: 'inimigo de', inverse: 'inimigo de', symmetric: true },
  { key: 'conhece', label: 'conhece', inverse: 'conhece', symmetric: true },
  { key: 'relacao_desconhecida', label: 'relação desconhecida com', inverse: 'relação desconhecida com', symmetric: true },
  { key: 'membro_de', label: 'membro de', inverse: 'tem como membro' },
  { key: 'lidera', label: 'lidera', inverse: 'é liderado por' },
  { key: 'progenitor_de', label: 'pai/mãe de', inverse: 'filho(a) de' },
  { key: 'localizado_em', label: 'localizado em', inverse: 'contém' },
  { key: 'pertence_a', label: 'pertence a', inverse: 'é dono de' },
  { key: 'protege', label: 'protege', inverse: 'é protegido por' },
  { key: 'matou', label: 'matou', inverse: 'foi morto por' },
];

async function semear() {
  const tipos = await db
    .insert(entityTypes)
    .values(TIPOS_DE_ENTIDADE.map((t) => ({ id: crypto.randomUUID(), ...t })))
    .onConflictDoNothing()
    .returning({ key: entityTypes.key });

  const relacoes = await db
    .insert(relationshipTypes)
    .values(TIPOS_DE_RELACAO.map((t) => ({ id: crypto.randomUUID(), ...t })))
    .onConflictDoNothing()
    .returning({ key: relationshipTypes.key });

  console.log(
    `tipos de entidade: ${tipos.length} inseridos, ${TIPOS_DE_ENTIDADE.length - tipos.length} já existiam`,
  );
  console.log(
    `tipos de relação:  ${relacoes.length} inseridos, ${TIPOS_DE_RELACAO.length - relacoes.length} já existiam`,
  );
}

await semear();
