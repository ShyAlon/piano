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

export class PitchDetector {
  private readonly timeData: Float32Array<ArrayBuffer>;
  private readonly frequencyData: Float32Array<ArrayBuffer>;
  private readonly binWidth: number;
  private readonly heldTones = new Map<NoteName, { tone: DetectedTone; seenAt: number }>();

  constructor(private readonly analyser: AnalyserNode, sampleRate: number) {
    this.timeData = new Float32Array(analyser.fftSize);
    this.frequencyData = new Float32Array(analyser.frequencyBinCount);
    this.binWidth = sampleRate / analyser.fftSize;
  }

  public detect(): DetectedTone[] {
    this.analyser.getFloatTimeDomainData(this.timeData);
    const rms = Math.sqrt(this.timeData.reduce((sum, sample) => sum + sample * sample, 0) / this.timeData.length);
    const now = performance.now();
    if (rms < 0.005) return this.activeHeldTones(now);

    this.analyser.getFloatFrequencyData(this.frequencyData);
    const primaryFrequency = this.autoCorrelate();
    const bandBins = NOTE_NAMES.map((note) => this.findPeakNear(FREQUENCIES[note]));
    const finiteLevels = bandBins.map((item) => item.db).filter(Number.isFinite);
    const strongestDb = Math.max(...finiteLevels);
    const sorted = [...finiteLevels].sort((a, b) => a - b);
    const noiseFloor = sorted[Math.floor(sorted.length * 0.35)] ?? -100;

    const tones = NOTE_NAMES.flatMap((note, index) => {
      const peak = bandBins[index];
      const cents = centsBetween(peak.frequency, FREQUENCIES[note]);
      const closeEnough = Math.abs(cents) <= 55;
      const sufficientlyClear = peak.db >= Math.max(noiseFloor + 7, strongestDb - 34, -82);
      const agreesWithPrimary = primaryFrequency > 0 && Math.abs(centsBetween(primaryFrequency, FREQUENCIES[note])) <= 55;
      if (!closeEnough || (!sufficientlyClear && !agreesWithPrimary)) return [];
      return [{
        note,
        frequency: agreesWithPrimary ? primaryFrequency : peak.frequency,
        cents: Math.round(agreesWithPrimary ? centsBetween(primaryFrequency, FREQUENCIES[note]) : cents),
        strength: Math.max(0, Math.min(1, (peak.db + 80) / 55)),
      }];
    });

    for (const tone of tones) this.heldTones.set(tone.note, { tone, seenAt: now });
    return this.activeHeldTones(now);
  }

  private activeHeldTones(now: number) {
    for (const [note, held] of this.heldTones) {
      if (now - held.seenAt > 280) this.heldTones.delete(note);
    }
    return [...this.heldTones.values()]
      .map(({ tone }) => tone)
      .sort((a, b) => FREQUENCIES[a.note] - FREQUENCIES[b.note]);
  }

  private findPeakNear(target: number) {
    const minFrequency = target * 2 ** (-55 / 1200);
    const maxFrequency = target * 2 ** (55 / 1200);
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
    return { frequency: (bestBin + Math.max(-0.5, Math.min(0.5, offset))) * this.binWidth, db: center };
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
