import { describe, it, expect } from 'vitest';
import { recordClassification, suggestionFor, normaliseMerchant } from '../domain/merchantMemory';

describe('merchant memory', () => {
  it('normalises merchant names (trim, collapse spaces, lowercase)', () => {
    expect(normaliseMerchant('  Shell   Gas ')).toBe('shell gas');
    expect(normaliseMerchant('SHELL')).toBe('shell');
  });

  it('one prior classification is not enough for a suggestion', () => {
    const e = recordClassification(null, 'Shell', 'Fuel', 't1');
    expect(suggestionFor(e)).toBeNull();
  });

  it('two consistent classifications produce a suggestion', () => {
    let e = recordClassification(null, 'Shell', 'Fuel', 't1');
    e = recordClassification(e, 'shell', 'Fuel', 't2');
    const s = suggestionFor(e);
    expect(s).not.toBeNull();
    expect(s!.category).toBe('Fuel');
    expect(s!.observations).toBe(2);
    expect(s!.reason).toContain('Fuel');
  });

  it('a tie for the top category yields no suggestion (never guesses)', () => {
    let e = recordClassification(null, 'Costco', 'Fuel', 't1');
    e = recordClassification(e, 'Costco', 'Fuel', 't2');
    e = recordClassification(e, 'Costco', 'Supplies', 't3');
    e = recordClassification(e, 'Costco', 'Supplies', 't4');
    expect(suggestionFor(e)).toBeNull();
  });

  it('suggestion is data only — it does not mutate the entry or auto-apply', () => {
    let e = recordClassification(null, 'Shell', 'Fuel', 't1');
    e = recordClassification(e, 'Shell', 'Fuel', 't2');
    const before = JSON.stringify(e);
    suggestionFor(e);
    expect(JSON.stringify(e)).toBe(before);
    // The user can still record a different category, overriding the trend.
    e = recordClassification(e, 'Shell', 'Supplies', 't3');
    expect(e.lastCategory).toBe('Supplies');
  });
});
