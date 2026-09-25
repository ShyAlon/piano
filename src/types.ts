export const NOTE_NAMES = ['C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4'] as const;

export type NoteName = (typeof NOTE_NAMES)[number];

export interface LessonNote {
  id: string;
  notes: NoteName[];
  timestampMs: number;
  durationMs: number;
  lyric?: string;
  isRest?: boolean;
}

export type ExecutionState = 'PENDING' | 'CORRECT' | 'WRONG';

export interface RenderableNote extends LessonNote {
  state: ExecutionState;
  xPosition: number;
}
