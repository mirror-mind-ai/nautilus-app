#!/usr/bin/env node
// CR278: refuses a macOS whisper-cli that a Mac on the oldest supported macOS could not start.
//
//   node scripts/check_whisper_cli_macos.mjs <whisper-cli>
//
// The published component asked for macOS 26 and, through Accelerate, for a symbol that exists only
// from macOS 13.3, so on macOS 12 the system refused to load it and the app said only that local
// transcription failed. This reads what the loader reads (`otool`, `nm`) and states the rule in one
// place: the floor of runtime-compatibility.json, and nothing but the system's own libraries.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const MACOS_FLOOR = "12.0";

const SYSTEM_LIBRARY = /^\/(usr\/lib|System\/Library)\//;
const ACCELERATE = /\/Accelerate\.framework\//;
// whisper.cpp's BLAS backend defines ACCELERATE_NEW_LAPACK whenever it finds Accelerate, and those
// symbols are missing from the framework on macOS 12 to 13.2 whatever the deployment target says.
const NEW_LAPACK = /NEWLAPACK/;

function versionParts(value) {
  return String(value).split(".").map((part) => Number.parseInt(part, 10) || 0);
}

function above(version, floor) {
  const left = versionParts(version);
  const right = versionParts(floor);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

/** The macOS version a binary asks for, from `otool -l` text; null when it names none. */
export function parseLoadCommands(text) {
  const blocks = String(text).split(/^Load command \d+$/m);
  for (const block of blocks) {
    if (/cmd LC_BUILD_VERSION/.test(block)) {
      const match = block.match(/^\s*minos (\S+)/m);
      if (match) return match[1];
    }
    if (/cmd LC_VERSION_MIN_MACOSX/.test(block)) {
      const match = block.match(/^\s*version (\S+)/m);
      if (match) return match[1];
    }
  }
  return null;
}

/** `facts` is { minos, libraries, undefinedSymbols }; returns { ok, problems }. */
export function checkWhisperCliMacos(facts) {
  const problems = [];
  if (!facts.minos) {
    problems.push("it names no minimum macOS version");
  } else if (above(facts.minos, MACOS_FLOOR)) {
    problems.push(`it needs macOS ${facts.minos}, and the supported floor is macOS ${MACOS_FLOOR}`);
  }
  for (const library of facts.libraries) {
    if (ACCELERATE.test(library)) {
      problems.push(`it links Accelerate (${library}); build without the BLAS backend`);
    } else if (!SYSTEM_LIBRARY.test(library)) {
      problems.push(`it loads ${library}, which is not one of the system's own libraries`);
    }
  }
  for (const symbol of facts.undefinedSymbols) {
    if (NEW_LAPACK.test(symbol)) problems.push(`it imports ${symbol}, which macOS 12 does not have`);
  }
  return { ok: problems.length === 0, problems };
}

function readFacts(path) {
  const tool = (command, args) => execFileSync(command, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const libraries = tool("otool", ["-L", path]).split("\n").slice(1)
    .map((line) => line.trim().replace(/ \(compatibility version.*$/, ""))
    .filter(Boolean);
  const undefinedSymbols = tool("nm", ["-u", path]).split("\n").map((line) => line.trim()).filter(Boolean);
  return { minos: parseLoadCommands(tool("otool", ["-l", path])), libraries, undefinedSymbols };
}

function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: check_whisper_cli_macos.mjs <whisper-cli>");
    process.exit(2);
  }
  const facts = readFacts(path);
  const { ok, problems } = checkWhisperCliMacos(facts);
  console.log(`minimum macOS ${facts.minos ?? "none"}; libraries ${facts.libraries.join(", ")}`);
  if (!ok) {
    for (const problem of problems) console.error(`REFUSED: ${problem}`);
    process.exit(1);
  }
  console.log(`ok: starts on macOS ${MACOS_FLOOR}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
