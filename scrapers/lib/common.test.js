import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const { matchBrand, matchBrandHit, isoYearWeek } = createRequire(import.meta.url)('./common.js');

describe('matchBrand', () => {
  it('erkennt Marken inkl. Schreibvarianten', () => {
    expect(matchBrand('Red  Bull Energy')).toBe('Red Bull');
    expect(matchBrand('Montana Black 0,5 l')).toBe('Gönnergy');
    expect(matchBrand('Spülmittel')).toBeNull();
  });
  it('strict: Wortgrenze gegen "Monstera"', () => {
    expect(matchBrand('Thai-Monstera', { strict: true })).toBeNull();
    expect(matchBrand('Thai-Monstera')).toBe('Monster');
    expect(matchBrand('Monster Ultra', { strict: true })).toBe('Monster');
  });
  it('requireEnergy: Marke UND "Energy"', () => {
    expect(matchBrand('Monster Trucks', { requireEnergy: true })).toBeNull();
    expect(matchBrand('Monster Energy', { requireEnergy: true })).toBe('Monster');
  });
  it('matchBrandHit liefert das Pattern mit', () => {
    expect(matchBrandHit('Rockstar Energy').pattern.test('rockstar')).toBe(true);
  });
});

describe('isoYearWeek', () => {
  it('Jahreswechsel & reguläre Woche', () => {
    expect(isoYearWeek(new Date('2026-07-22T00:00:00Z'))).toEqual({ year: 2026, week: 30 });
    expect(isoYearWeek(new Date('2026-01-01T00:00:00Z'))).toEqual({ year: 2026, week: 1 });
    expect(isoYearWeek(new Date('2024-12-30T00:00:00Z'))).toEqual({ year: 2025, week: 1 });
    expect(isoYearWeek(new Date('2021-01-03T00:00:00Z'))).toEqual({ year: 2020, week: 53 });
  });
});

describe('weekValidity', () => {
  const { weekValidity } = createRequire(import.meta.url)('./common.js');
  it('KW41/2026 in Berliner Ortszeit (Sommerzeit): Mo 00:00 bis Sa bzw. So 23:59', () => {
    expect(weekValidity(2026, 41)).toEqual({ validFrom: '2026-10-04T22:00:00.000Z', validTo: '2026-10-10T21:59:00.000Z' });
    expect(weekValidity(2026, 41, 6).validTo).toBe('2026-10-11T21:59:00.000Z');
  });
  it('Winterzeit (+1 h) und Jahreswechsel', () => {
    expect(weekValidity(2026, 2).validFrom).toBe('2026-01-04T23:00:00.000Z');
    expect(weekValidity(2026, 1).validFrom).toBe('2025-12-28T23:00:00.000Z');
  });
});
