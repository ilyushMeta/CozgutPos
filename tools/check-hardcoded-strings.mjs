#!/usr/bin/env node
/**
 * Lightweight guard against hardcoded UI strings in the client (CLAUDE.md rule #4).
 * Flags JSX text nodes with 2+ letter words that are not wrapped in t('...').
 * Heuristic, not a parser — allowlist covers acceptable literals.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('../apps/client/src', import.meta.url).pathname;
const ALLOW = [
  /^[\s\d.,:;!?%×✓☀️🌙+\-/()]*$/u,
  /app\.name/,
  /Çözgüt POS/,
  /^(TMT|USD)$/, // currency codes are not translated in any locale
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (['.tsx', '.jsx'].includes(extname(p))) out.push(p);
  }
  return out;
}

const violations = [];
for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    // JSX text between > and < that contains letters, ignoring {expressions}.
    // (?<!=) excludes arrow-function `=>` so `() => foo<Bar>()` isn't misread as JSX text.
    const m = line.match(/(?<!=)>\s*([A-Za-zÇĞİÖŞÜçğıöşü][^<>{}]*[A-Za-zÇĞİÖŞÜçğıöşü])\s*</);
    if (!m) return;
    const text = m[1].trim();
    if (ALLOW.some((rx) => rx.test(text))) return;
    violations.push(`${file}:${i + 1}  "${text}"`);
  });
}

if (violations.length) {
  console.error('Hardcoded UI strings found (use t() / i18n keys):');
  for (const v of violations) console.error('  ' + v);
  process.exit(1);
}
console.log('OK: no hardcoded UI strings detected.');
