import type { LessonNote, NoteName, RenderableNote } from './types';

export interface Tune {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  difficulty: 'Easy' | 'Medium';
  notes: LessonNote[];
}

type ScoreEvent = { notes: NoteName[]; beats: number; lyric?: string; isRest?: boolean };
const n = (note: NoteName | NoteName[], beats = 1, lyric?: string): ScoreEvent => ({ notes: Array.isArray(note) ? note : [note], beats, lyric });
const rest = (beats = 1): ScoreEvent => ({ notes: [], beats, isRest: true });

function score(id: string, events: ScoreEvent[], beatMs = 650): LessonNote[] {
  let beat = 0;
  return events.map((event, index) => {
    const item: LessonNote = {
      id: `${id}-${index}`,
      notes: event.notes,
      timestampMs: 1800 + beat * beatMs,
      durationMs: event.beats * beatMs,
      lyric: event.lyric,
      isRest: event.isRest,
    };
    beat += event.beats;
    return item;
  });
}

export const TUNES: Tune[] = [
  {
    id: 'twinkle', title: 'Twinkle, Twinkle', subtitle: 'Long notes and gentle steps', icon: '★', difficulty: 'Easy',
    notes: score('twinkle', [
      n('C4', 1, 'Twin-'), n('C4', 1, 'kle'), n('G4', 1, 'twin-'), n('G4', 1, 'kle'), n('A4', 1, 'lit-'), n('A4', 1, 'tle'), n('G4', 2, 'star'), rest(.5),
      n('F4', 1, 'How'), n('F4', 1, 'I'), n('E4', 1, 'won-'), n('E4', 1, 'der'), n('D4', 1, 'what'), n('D4', 1, 'you'), n('C4', 2, 'are'),
    ]),
  },
  {
    id: 'mary', title: 'Mary Had a Little Lamb', subtitle: 'Practice stepping notes', icon: '♩', difficulty: 'Easy',
    notes: score('mary', [
      n('E4', 1, 'Ma-'), n('D4', 1, 'ry'), n('C4', 1, 'had'), n('D4', 1, 'a'), n('E4', 1, 'lit-'), n('E4', 1, 'tle'), n('E4', 2, 'lamb'), rest(.5),
      n('D4', 1, 'lit-'), n('D4', 1, 'tle'), n('D4', 2, 'lamb'), n('E4', 1, 'lit-'), n('G4', 1, 'tle'), n('G4', 2, 'lamb'),
    ]),
  },
  {
    id: 'ode', title: 'Ode to Joy', subtitle: 'A timeless beginner favorite', icon: '♪', difficulty: 'Medium',
    notes: score('ode', [
      n('E4', 1, 'Joy-'), n('E4', 1, 'ful'), n('F4', 1, 'joy-'), n('G4', 1, 'ful'), n('G4', 1, 'we'), n('F4', 1, 'a-'), n('E4', 1, 'dore'), n('D4', 1, 'thee'),
      n('C4', 1, 'God'), n('C4', 1, 'of'), n('D4', 1, 'glo-'), n('E4', 1, 'ry'), n('E4', 1.5, 'Lord'), n('D4', .5, 'of'), n('D4', 2, 'love'),
    ], 600),
  },
  {
    id: 'row', title: 'Row, Row, Row Your Boat', subtitle: 'Feel short and long beats', icon: '⛵', difficulty: 'Easy',
    notes: score('row', [
      n('C4', 1.5, 'Row'), n('C4', .5, 'row'), n('C4', 1, 'row'), n('D4', .5, 'your'), n('E4', 1.5, 'boat'),
      n('E4', 1, 'Gent-'), n('D4', 1, 'ly'), n('E4', 1, 'down'), n('F4', 1, 'the'), n('G4', 2, 'stream'), rest(.5),
      n('C4', .5, 'Mer-'), n('C4', .5, 'ri-'), n('G4', .5, 'ly'), n('G4', .5, 'mer-'), n('E4', .5, 'ri-'), n('E4', .5, 'ly'), n('C4', 1, 'life'), n('G4', 1, 'is'), n('F4', 1, 'but'), n('E4', 1, 'a'), n('D4', 1, 'dream'), n('C4', 2, 'dream'),
    ], 560),
  },
  {
    id: 'frere', title: 'Are You Sleeping?', subtitle: 'Frère Jacques in English', icon: '🔔', difficulty: 'Easy',
    notes: score('frere', [
      n('C4', 1, 'Are'), n('D4', 1, 'you'), n('E4', 1, 'sleep-'), n('C4', 1, 'ing?'), n('C4', 1, 'Are'), n('D4', 1, 'you'), n('E4', 1, 'sleep-'), n('C4', 1, 'ing?'),
      n('E4', 1, 'Broth-'), n('F4', 1, 'er'), n('G4', 2, 'John'), rest(.5), n('E4', 1, 'Broth-'), n('F4', 1, 'er'), n('G4', 2, 'John'),
    ]),
  },
  {
    id: 'london', title: 'London Bridge', subtitle: 'A playful descending melody', icon: '♬', difficulty: 'Medium',
    notes: score('london', [
      n('G4', 1, 'Lon-'), n('A4', 1, 'don'), n('G4', 1, 'Bridge'), n('F4', 1, 'is'), n('E4', 1, 'fall-'), n('F4', 1, 'ing'), n('G4', 2, 'down'), rest(.5),
      n('D4', 1, 'fall-'), n('E4', 1, 'ing'), n('F4', 2, 'down'), n('E4', 1, 'fall-'), n('F4', 1, 'ing'), n('G4', 2, 'down'),
    ], 590),
  },
  {
    id: 'chords', title: 'Magic Triads', subtitle: 'Learn three-note chords', icon: '✦', difficulty: 'Medium',
    notes: score('chords', [
      n(['C4', 'E4', 'G4'], 2, 'Bright'), rest(1), n(['D4', 'F#4', 'A4'], 2, 'and'), rest(.5),
      n(['C4', 'F4', 'A4'], 2, 'strong'), rest(1), n(['D4', 'G4', 'B4'], 2, 'we'), n(['C4', 'E4', 'G4'], 3, 'play'),
    ], 720),
  },
];

export const DEMO_LESSON = TUNES[0].notes;

export class LessonStateManager {
  public currentLessonTimeMs = 0;
  public readonly activeNotes: RenderableNote[];
  public currentTargetIndex = 0;
  public isWaitModeActive = true;
  private missedNoteIds = new Set<string>();

  constructor(notes: LessonNote[]) {
    this.activeNotes = notes.map((note) => ({ ...note, notes: [...note.notes], state: 'PENDING', xPosition: 0 }));
  }

  public updateTicks(deltaTimeMs: number, latestDetectedNotes: NoteName[]) {
    const currentTarget = this.activeNotes[this.currentTargetIndex];
    if (!currentTarget) return;

    if (currentTarget.timestampMs - this.currentLessonTimeMs <= 0) {
      if (currentTarget.isRest) {
        currentTarget.state = 'CORRECT';
        this.currentTargetIndex += 1;
        this.currentLessonTimeMs += deltaTimeMs;
        return;
      }

      const isMatch = currentTarget.notes.every((note) => latestDetectedNotes.includes(note));
      if (isMatch) {
        currentTarget.state = 'CORRECT';
        this.currentTargetIndex += 1;
        this.currentLessonTimeMs += deltaTimeMs;
      } else {
        currentTarget.state = 'WRONG';
        if (latestDetectedNotes.length > 0) this.missedNoteIds.add(currentTarget.id);
        if (!this.isWaitModeActive) this.currentLessonTimeMs += deltaTimeMs;
      }
      return;
    }
    this.currentLessonTimeMs += deltaTimeMs;
  }

  public get successRate() {
    const playable = this.activeNotes.filter((note) => !note.isRest);
    if (!playable.length) return 100;
    return Math.round(((playable.length - this.missedNoteIds.size) / playable.length) * 100);
  }

  public get missedCount() { return this.missedNoteIds.size; }
  public get playableCount() { return this.activeNotes.filter((note) => !note.isRest).length; }

  public setWaitMode(enabled: boolean) { this.isWaitModeActive = enabled; }

  public reset() {
    this.currentLessonTimeMs = 0;
    this.currentTargetIndex = 0;
    this.missedNoteIds.clear();
    for (const note of this.activeNotes) {
      note.state = 'PENDING';
      note.xPosition = 0;
    }
  }
}
