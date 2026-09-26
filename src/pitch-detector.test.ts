import { describe, expect, it } from 'vitest';
import { calculateRms, isPlausiblePeak, selectStrongestTones, type DetectedTone } from './pitch-detector';

const tone = (note: DetectedTone['note'], strength: number): DetectedTone => ({
  note,
  strength,
  frequency: 440,
  cents: 0,
});

describe('pitch detector safeguards', () => {
  it('calculates signal level without producing NaN for empty input', () => {
    expect(calculateRms([])).toBe(0);
    expect(calculateRms([0, 1, -1])).toBeCloseTo(Math.sqrt(2 / 3));
  });

  it('rejects out-of-tune and indistinct spectral peaks', () => {
    expect(isPlausiblePeak({ cents: 48, db: -30, noiseFloor: -80, strongestDb: -25, prominence: 10, agreesWithPrimary: false })).toBe(false);
    expect(isPlausiblePeak({ cents: 4, db: -36, noiseFloor: -80, strongestDb: -25, prominence: 2, agreesWithPrimary: false })).toBe(false);
  });

  it('accepts a clear peak and a close autocorrelation match', () => {
    expect(isPlausiblePeak({ cents: -8, db: -38, noiseFloor: -74, strongestDb: -24, prominence: 7, agreesWithPrimary: false })).toBe(true);
    expect(isPlausiblePeak({ cents: 10, db: -82, noiseFloor: -75, strongestDb: -25, prominence: 1, agreesWithPrimary: true })).toBe(true);
  });

  it('keeps only the three strongest chord tones', () => {
    const selected = selectStrongestTones([
      tone('C4', 0.9), tone('E4', 0.7), tone('G4', 0.8), tone('B4', 0.2),
    ]);
    expect(selected.map(({ note }) => note)).toEqual(['C4', 'G4', 'E4']);
  });
});
