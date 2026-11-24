import { describe, it, expect } from 'vitest';
import { toCairene } from '../../scripts/eg-pronunciation.mjs';

describe('Cairo pronunciation for the Egyptian voice', () => {
  it('ق becomes a glottal stop (أ) and ج becomes a hard g', () => {
    expect(toCairene('شُكْرًا قَوِي')).toBe('شُكْرًا أَوِي');
    expect(toCairene('عَايِز قَهْوَة')).toBe('عَايِز أَهْوَة');
    expect(toCairene('اِلْجَوّ جَمِيل')).toBe('اِلْگَوّ گَمِيل');
  });
  it('القاهرة keeps its real ق, with or without marks, but its ج-free letters are untouched', () => {
    expect(toCairene('أَنَا مِنْ اِلْقَاهِرَة')).toBe('أَنَا مِنْ اِلْقَاهِرَة');
    expect(toCairene('مِنْ القاهرة قريب')).toBe('مِنْ القاهرة أريب');
  });
  it('leaves text without ق or ج alone and is safe to apply twice', () => {
    const s = 'أَنَا مِنْ مَصْر';
    expect(toCairene(s)).toBe(s);
    expect(toCairene(toCairene('قَوِي جَمِيل'))).toBe(toCairene('قَوِي جَمِيل'));
  });
});
