// CR281: gives every CSS declaration that uses color-mix() one before it that does not.
//
// WebKit 15, the engine of macOS 12 until Safari is updated, does not know color-mix() (Safari 16.2).
// It drops the whole declaration, so `background: color-mix(...)` leaves a surface with no
// background: the update panel drew its text over the sidebar. The browser uses the last declaration
// it understands, so a plain one placed first costs nothing where the mix works.
//
// The plain value is the mix with each colour pair replaced by the dominant colour: the one with the
// larger share, the first on a tie. A tint over `transparent` therefore falls back to nothing, which
// is what the engine showed anyway, and a surface mixed from two opaque colours falls back to the
// main one. A declaration that already has a plain one of its own before it is left as written.

const MIX = "color-mix(";

/** The index of the parenthesis that closes the one opened at `open`, or -1. */
function closing(text, open) {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === "(") depth += 1;
    else if (text[index] === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "(") depth += 1;
    else if (text[index] === ")") depth -= 1;
    else if (text[index] === "," && depth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim());
}

/** `30% red`, `red 30%` or `red`: the colour and its share, when it has one. */
function colourAndShare(text) {
  const leading = text.match(/^(\d*\.?\d+)%\s+([\s\S]+)$/);
  if (leading) return { colour: leading[2].trim(), share: Number(leading[1]) };
  const trailing = text.match(/^([\s\S]+?)\s+(\d*\.?\d+)%$/);
  if (trailing) return { colour: trailing[1].trim(), share: Number(trailing[2]) };
  return { colour: text.trim(), share: undefined };
}

function dominant(inner) {
  const parts = splitTopLevel(inner);
  if (parts.length !== 3 || !/^in\s+\S/i.test(parts[0])) return null;
  const first = colourAndShare(parts[1]);
  const second = colourAndShare(parts[2]);
  if (!first.colour || !second.colour) return null;
  let left = first.share;
  let right = second.share;
  if (left === undefined && right === undefined) [left, right] = [50, 50];
  else if (left === undefined) left = 100 - right;
  else if (right === undefined) right = 100 - left;
  if (left + right <= 0) return null;
  return right > left ? second.colour : first.colour;
}

/** The value with every color-mix() replaced by its dominant colour; null when one cannot be read. */
export function withoutColorMix(value) {
  let result = "";
  let cursor = 0;
  for (;;) {
    const start = value.indexOf(MIX, cursor);
    if (start === -1) return result + value.slice(cursor);
    const open = start + MIX.length - 1;
    const end = closing(value, open);
    if (end === -1) return null;
    const colour = dominant(value.slice(open + 1, end));
    if (colour === null) return null;
    const plain = colour.includes(MIX) ? withoutColorMix(colour) : colour;
    if (plain === null) return null;
    result += value.slice(cursor, start) + plain;
    cursor = end + 1;
  }
}

function hasPlainFallback(declaration) {
  for (let earlier = declaration.prev(); earlier; earlier = earlier.prev()) {
    if (earlier.type === "decl" && earlier.prop.toLowerCase() === declaration.prop.toLowerCase() && !earlier.value.includes(MIX)) {
      return true;
    }
  }
  return false;
}

export default function colorMixFallback() {
  return {
    postcssPlugin: "mirror-color-mix-fallback",
    Declaration(declaration) {
      // A custom property holds its text unparsed, so the engine keeps it and the declaration that
      // reads it fails later; a sibling declaration cannot repair that.
      if (declaration.prop.startsWith("--") || !declaration.value.includes(MIX)) return;
      if (hasPlainFallback(declaration)) return;
      const plain = withoutColorMix(declaration.value);
      if (plain === null) return;
      declaration.before(declaration.clone({ value: plain }));
    },
  };
}

colorMixFallback.postcss = true;
