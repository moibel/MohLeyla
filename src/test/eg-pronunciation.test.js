import { describe, it, expect } from 'vitest';
import { toCairene } from '../../scripts/eg-pronunciation.mjs';

describe('Cairo pronunciation for the Egyptian voice', () => {
  it('ق at the start of a word becomes a glottal stop (أ)', () => {
    expect(toCairene('شُكْرًا قَوِي')).toBe('شُكْرًا أَوِي');
    expect(toCairene('عَايِز قَهْوَة')).toBe('عَايِز أَهْوَة');
    expect(toCairene('مِنْ قَرِيب')).toBe('مِنْ أَرِيب');
  });
  it('a long ā after the first ق becomes آ', () => {
    expect(toCairene('قَالَ')).toBe('آلَ');
  });
  it('ق anywhere else stays a real q, including after a prefix such as ال', () => {
    expect(toCairene('أَنَا مِنْ اِلْقَاهِرَة')).toBe('أَنَا مِنْ اِلْقَاهِرَة');
    expect(toCairene('دِلْوَقْتِي')).toBe('دِلْوَقْتِي');
    expect(toCairene('اِلسُّوق مُوَافِق')).toBe('اِلسُّوق مُوَافِق');
    expect(toCairene('اِلْقَهْوَة')).toBe('اِلْقَهْوَة');
  });
  it('ج becomes a hard g everywhere', () => {
    expect(toCairene('اِلْجَوّ جَمِيل')).toBe('اِلْگَوّ گَمِيل');
    expect(toCairene('جَمِيل قَوِي')).toBe('گَمِيل أَوِي');
  });
  it('leaves other text alone and is safe to apply twice', () => {
    const s = 'أَنَا مِنْ مَصْر';
    expect(toCairene(s)).toBe(s);
    expect(toCairene(toCairene('قَوِي جَمِيل'))).toBe(toCairene('قَوِي جَمِيل'));
  });
});
