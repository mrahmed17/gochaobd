export const bdt = (n: number) => `৳${n.toLocaleString("en-BD")}`;

export function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
