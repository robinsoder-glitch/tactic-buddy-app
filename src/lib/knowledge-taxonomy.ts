/** Samma ämnen och benämningar i läsvy, administration och import. */
export const KNOWLEDGE_TOPICS = {
  getting_started: "Börja som tränare",
  planning: "Träningsplanering",
  technique: "Teknik med boll",
  game_understanding: "Spelförståelse och taktik",
  physical: "Fysik och motorik",
  nutrition: "Kost, vätska och återhämtning",
  goalkeeper: "Målvakt",
  coaching: "Ledarskap och pedagogik",
  team_environment: "Laget, relationer och föräldrar",
  inclusion: "Trygghet och inkludering",
  injury: "Skador och skadeprevention",
  rules_formats: "Match och spelformer",
  // Äldre poster/importer stöds. Nya forskningsposter kategoriseras efter ämne.
  research: "Fördjupning och forskning",
} as const;

export function knowledgeTopicId(label: string): string {
  return Object.entries(KNOWLEDGE_TOPICS).find(([, value]) => value === label)?.[0] ?? label;
}

export function knowledgeTopicLabel(id: string): string {
  return KNOWLEDGE_TOPICS[id as keyof typeof KNOWLEDGE_TOPICS] ?? id;
}
