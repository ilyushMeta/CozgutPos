import { describe, it, expect } from 'vitest';
import { translit } from './translit.js';

describe('translit (SPEC §7.3 PLU translit-safe names)', () => {
  it('folds Turkmen diacritics to ASCII', () => {
    expect(translit('çörek')).toBe('corek');
    expect(translit('Çäýşek')).toBe('Caysek');
    expect(translit('gaýmak, üzüm we ýaňy açylan')).toBe('gaymak, uzum we yany acylan');
  });

  it('leaves plain ASCII untouched', () => {
    expect(translit('Suw 0.5L')).toBe('Suw 0.5L');
  });
});
