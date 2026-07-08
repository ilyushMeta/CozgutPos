/**
 * Turkmen → scale-hardware-safe transliteration (SPEC §7.3 PLU export:
 * "name (translit-safe)"). Many weighing-scale brands only accept plain
 * ASCII in their PLU tables, so Turkmen Latin diacritics are folded down.
 */
const MAP: Record<string, string> = {
  ç: 'c',
  Ç: 'C',
  ö: 'o',
  Ö: 'O',
  ş: 's',
  Ş: 'S',
  ü: 'u',
  Ü: 'U',
  ý: 'y',
  Ý: 'Y',
  ň: 'n',
  Ň: 'N',
  ž: 'j',
  Ž: 'J',
  ä: 'a',
  Ä: 'A',
};

/** Fold Turkmen diacritics to plain ASCII. Non-mapped characters pass through. */
export function translit(input: string): string {
  return input.replace(/[çÇöÖşŞüÜýÝňŇžŽäÄ]/g, (ch) => MAP[ch] ?? ch);
}
