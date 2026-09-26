/** The four reactions the old blog had, kept so their counts carry over. */
export const REACTIONS = [
  { key: "like", emoji: "👍", label: "Helpful" },
  { key: "fire", emoji: "🔥", label: "Fire" },
  { key: "love", emoji: "❤️", label: "Love it" },
  { key: "insightful", emoji: "💡", label: "Learned something" },
] as const;

export type Reaction = (typeof REACTIONS)[number]["key"];
export const isReaction = (r: string): r is Reaction => REACTIONS.some((x) => x.key === r);
