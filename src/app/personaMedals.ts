/** Bundled defaults: only these known names resolve to public image assets. Custom images remain per home. */
export const MEDAL_IDS = [
  "ai-engineer", "coach", "database-architect", "designer", "devops-engineer", "doctor",
  "engineer", "financial", "fiscal-navigator", "learning-architect", "ma-strategist",
  "media-buyer", "prompt-engineer", "quality-assurance", "quartermaster", "researcher",
  "security-engineer", "stoic", "strategist", "teacher", "therapist", "thinker", "writer",
] as const;

export function builtInPersonaMedal(id: string): string | undefined {
  return (MEDAL_IDS as readonly string[]).includes(id) ? `/persona-medals/${id}.png` : undefined;
}
