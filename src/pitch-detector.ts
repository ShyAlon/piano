import { NOTE_NAMES, type NoteName } from './types';

export interface DetectedTone {
  note: NoteName;
  frequency: number;
  cents: number;
  strength: number;
}

const FREQUENCIES: Record<NoteName, number> = {
  C4: 261.63,
  'C#4': 277.18,
  D4: 293.66,
  'D#4': 311.13,
  E4: 329.63,
  F4: 349.23,
  'F#4': 369.99,
  G4: 392,
  'G#4': 415.3,
  A4: 440,
  'A#4': 466.16,
  B4: 493.88,
};

const centsBetween = (frequency: number, reference: number) => 1200 * Math.log2(frequency / reference);

export const DETECTION_CONFIG = {
  centsTolerance: 42,
  minimumRms: 0.005,
  minimumSignalAboveNoiseDb: 12,
  maximumDropFromStrongestDb: 28,
  minimumAbsoluteDb: -78,
  minimumProminenceDb: 4.5,
  confirmationFrames: 2,
  holdMs: 160,
  maxPolyphony: 3,
} as const;

export interface PeakAssessment {
  cents: number;
  db: number;
  noiseFloor: number;
  strongestDb: number;
  prominence: number;
  agreesWithPrimary: boolean;
}

export function calculateRms(samples: ArrayLike<number>) {
  if (samples.length === 0) return 0;
  let sumOfSquares = 0;
  for (let index = 0; index < samples.length; index += 1) sumOfSquares += samples[index] ** 2;
  return Math.sqrt(sumOfSquares / samples.length);
}

export function isPlausiblePeak(peak: PeakAssessment) {
  if (Math.abs(peak.cents) > DETECTION_CONFIG.centsTolerance) return false;
  if (peak.agreesWithPrimary) return true;
  const minimumDb = Math.max(
    peak.noiseFloor + DETECTION_CONFIG.minimumSignalAboveNoiseDb,
    peak.strongestDb - DETECTION_CONFIG.maximumDropFromStrongestDb,
    DETECTION_CONFIG.minimumAbsoluteDb,
  );
  return peak.db >= minimumDb && peak.prominence >= DETECTION_CONFIG.minimumProminenceDb;
}

export function selectStrongestTones(tones: DetectedTone[], limit = DETECTION_CONFIG.maxPolyphony) {
  return [...tones].sort((a, b) => b.strength - a.strength).slice(0, limit);
}

export class PitchDetector {
  private readonly timeData: Float32Array<ArrayBuffer>;
  private readonly frequencyData: Float32Array<ArrayBuffer>;
  private readonly binWidth: number;
  private readonly heldTones = new Map<NoteName, { tone: DetectedTone; seenAt: number }>();
  private readonly confirmationFrames = new Map<NoteName, number>();

  constructor(private readonly analyser: AnalyserNode, sampleRate: number) {
    this.timeData = new Float32Array(analyser.fftSize);
    this.frequencyData = new Float32Array(analyser.frequencyBinCount);
    this.binWidth = sampleRate / analyser.fftSize;
  }

  public detect(): DetectedTone[] {
    this.analyser.getFloatTimeDomainData(this.timeData);
    const rms = calculateRms(this.timeData);
    const now = performance.now();
    if (rms < DETECTION_CONFIG.minimumRms) return this.activeHeldTones(now);

    this.analyser.getFloatFrequencyData(this.frequencyData);
    const primaryFrequency = this.autoCorrelate();
    const bandBins = NOTE_NAMES.map((note) => this.findPeakNear(FREQUENCIES[note]));
    const finiteLevels = bandBins.map((item) => item.db).filter(Number.isFinite);
    const strongestDb = Math.max(...finiteLevels);
    const noiseFloor = this.estimateNoiseFloor();

    const candidates = NOTE_NAMES.flatMap((note, index) => {
      const peak = bandBins[index];
      const cents = centsBetween(peak.frequency, FREQUENCIES[note]);
      const agreesWithPrimary = primaryFrequency > 0 && Math.abs(centsBetween(primaryFrequency, FREQUENCIES[note])) <= DETECTION_CONFIG.centsTolerance;
      if (!isPlausiblePeak({ ...peak, cents, noiseFloor, strongestDb, agreesWithPrimary })) return [];
      return [{
        tone: {
          note,
          frequency: agreesWithPrimary ? primaryFrequency : peak.frequency,
          cents: Math.round(agreesWithPrimary ? centsBetween(primaryFrequency, FREQUENCIES[note]) : cents),
          strength: Math.max(0, Math.min(1, (peak.db + 78) / 52)),
        },
        score: peak.db + peak.prominence * 1.5,
        agreesWithPrimary,
      }];
    });

    const candidateNotes = new Set(candidates.map(({ tone }) => tone.note));
    for (const note of NOTE_NAMES) {
      if (!candidateNotes.has(note)) this.confirmationFrames.delete(note);
    }

    const confirmed = candidates
      .map((candidate) => {
        const frames = (this.confirmationFrames.get(candidate.tone.note) ?? 0) + 1;
        this.confirmationFrames.set(candidate.tone.note, frames);
        return { ...candidate, frames };
      })
      .filter(({ agreesWithPrimary, frames }) => agreesWithPrimary || frames >= DETECTION_CONFIG.confirmationFrames)
      .sort((a, b) => b.score - a.score)
      .slice(0, DETECTION_CONFIG.maxPolyphony);

    for (const { tone } of confirmed) this.heldTones.set(tone.note, { tone, seenAt: now });
    return this.activeHeldTones(now);
  }

  private activeHeldTones(now: number) {
    for (const [note, held] of this.heldTones) {
      if (now - held.seenAt > DETECTION_CONFIG.holdMs) this.heldTones.delete(note);
    }
    return selectStrongestTones([...this.heldTones.values()].map(({ tone }) => tone))
      .sort((a, b) => FREQUENCIES[a.note] - FREQUENCIES[b.note]);
  }

  private findPeakNear(target: number) {
    const minFrequency = target * 2 ** (-DETECTION_CONFIG.centsTolerance / 1200);
    const maxFrequency = target * 2 ** (DETECTION_CONFIG.centsTolerance / 1200);
    const start = Math.max(1, Math.floor(minFrequency / this.binWidth));
    const end = Math.min(this.frequencyData.length - 2, Math.ceil(maxFrequency / this.binWidth));
    let bestBin = start;
    for (let bin = start + 1; bin <= end; bin += 1) {
      if (this.frequencyData[bin] > this.frequencyData[bestBin]) bestBin = bin;
    }
    const left = this.frequencyData[bestBin - 1];
    const center = this.frequencyData[bestBin];
    const right = this.frequencyData[bestBin + 1];
    const denominator = left - 2 * center + right;
    const offset = denominator === 0 ? 0 : 0.5 * (left - right) / denominator;
    const shoulderOffset = Math.max(2, Math.round((target * (2 ** (72 / 1200) - 1)) / this.binWidth));
    const lowerShoulder = this.frequencyData[Math.max(1, bestBin - shoulderOffset)];
    const upperShoulder = this.frequencyData[Math.min(this.frequencyData.length - 1, bestBin + shoulderOffset)];
    return {
      frequency: (bestBin + Math.max(-0.5, Math.min(0.5, offset))) * this.binWidth,
      db: center,
      prominence: center - (lowerShoulder + upperShoulder) / 2,
    };
  }

  private estimateNoiseFloor() {
    const start = Math.floor(235 / this.binWidth);
    const end = Math.min(this.frequencyData.length - 1, Math.ceil(530 / this.binWidth));
    const samples: number[] = [];
    for (let bin = start; bin <= end; bin += 3) samples.push(this.frequencyData[bin]);
    samples.sort((a, b) => a - b);
    return samples[Math.floor(samples.length * 0.5)] ?? -100;
  }

  private autoCorrelate() {
    const minimumLag = Math.floor(this.analyser.context.sampleRate / 520);
    const maximumLag = Math.ceil(this.analyser.context.sampleRate / 245);
    const usable = Math.min(this.timeData.length, 4096);
    let bestLag = -1;
    let bestCorrelation = 0;

    for (let lag = minimumLag; lag <= maximumLag; lag += 1) {
      let correlation = 0;
      let energyA = 0;
      let energyB = 0;
      for (let i = 0; i < usable - lag; i += 1) {
        const a = this.timeData[i];
        const b = this.timeData[i + lag];
        correlation += a * b;
        energyA += a * a;
        energyB += b * b;
      }
      const normalized = correlation / Math.sqrt(energyA * energyB);
      if (normalized > bestCorrelation) {
        bestCorrelation = normalized;
        bestLag = lag;
      }
    }

    if (bestLag < 0 || bestCorrelation < 0.72) return -1;
    return this.analyser.context.sampleRate / bestLag;
  }
}
