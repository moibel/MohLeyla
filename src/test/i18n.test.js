import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

describe('i18n resources', () => {
  it('ar / en / id have identical keys, placeholders and script rules', () => {
    const out = execFileSync('node', [path.resolve(__dirname, '../../scripts/validate-i18n.mjs')], { encoding: 'utf8' });
    expect(out).toContain('i18n OK');
  });
});
