/**
 * CR213: each persona keeps one colour, taken from its id, with nothing to configure. The dark
 * theme draws it in CSS from the hue alone; the light themes need a colour dark enough that the
 * white ◇ and the persona's name read at 4.5:1 on every light surface, which only arithmetic on the
 * actual colour can promise.
 */

/** Every surface a persona's name or avatar sits on in the light themes. */
// Surfaces and raised surfaces of daylight, mist and parchment, and the canvas of the contrast rule.
const LIGHT_SURFACES = ["#ffffff", "#f6f7f9", "#f4f1ea", "#fffdf7", "#f0f2f5", "#edf3f8", "#f4eddc"] as const;
const LIGHT_SATURATION = 55;
const LIGHT_START_LIGHTNESS = 42;
const MIN_CONTRAST = 4.5;

/** FNV-1a, spread by the golden angle so neighbouring hashes land far apart on the wheel. */
export function personaHue(personaId: string): number {
  let hash = 2166136261;
  for (const character of personaId) hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), 16777619) >>> 0;
  return Math.round((hash % 1000) * 137.508) % 360;
}

/** The persona's colour on the light themes, as `#rrggbb`. */
export function personaLightColour(personaId: string): string {
  const hue = personaHue(personaId);
  for (let lightness = LIGHT_START_LIGHTNESS; lightness > 0; lightness -= 1) {
    const colour = hslToHex(hue, LIGHT_SATURATION, lightness);
    if (LIGHT_SURFACES.every((surface) => contrastRatio(colour, surface) >= MIN_CONTRAST)) return colour;
  }
  return "#000000";
}

/** WCAG contrast between two `#rrggbb` colours. */
export function contrastRatio(left: string, right: string): number {
  const [lighter, darker] = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const [red, green, blue] = channels.map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * value).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}
