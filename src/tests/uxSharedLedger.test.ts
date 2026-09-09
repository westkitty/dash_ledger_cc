import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('five-UI shared ledger regression', () => {
  it('keeps both canonical and alternate UI trees under one LedgerProvider', () => {
    const main = source('src/main.tsx');
    const providerStart = main.indexOf('<LedgerProvider>');
    const providerEnd = main.indexOf('</LedgerProvider>');
    const app = main.indexOf('<App />');
    const alternate = main.indexOf('<UxLabApp />');

    expect(providerStart).toBeGreaterThan(-1);
    expect(providerEnd).toBeGreaterThan(providerStart);
    expect(app).toBeGreaterThan(providerStart);
    expect(app).toBeLessThan(providerEnd);
    expect(alternate).toBeGreaterThan(providerStart);
    expect(alternate).toBeLessThan(providerEnd);
  });

  it('does not reconnect any alternate concept to synthetic fixtures', () => {
    for (const file of [
      'src/ux-lab/concepts/Concept1ReachDesk.tsx',
      'src/ux-lab/concepts/Concept2ReviewQueue.tsx',
      'src/ux-lab/concepts/Concept3WeekStory.tsx',
      'src/ux-lab/concepts/Concept4YearGlance.tsx',
    ]) {
      const text = source(file);
      expect(text).not.toContain("from '../fixtures'");
      expect(text).not.toContain('Local mock state only');
    }
  });

  it('keeps the alternate app dependent on the live ledger readiness state', () => {
    const alternate = source('src/ux-lab/UxLabApp.tsx');
    expect(alternate).toContain('useLedgerContext');
    expect(alternate).toContain("status === 'loading'");
  });
});
