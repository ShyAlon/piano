import { describe, expect, it } from 'vitest';
import { LessonStateManager } from './lesson';

describe('LessonStateManager', () => {
  it('freezes at an unmatched target in wait mode', () => {
    const manager = new LessonStateManager([{ id: 'a', notes: ['C4'], timestampMs: 100, durationMs: 50 }]);
    manager.updateTicks(100, []);
    manager.updateTicks(20, ['D4']);
    expect(manager.currentLessonTimeMs).toBe(100);
    expect(manager.activeNotes[0].state).toBe('WRONG');
  });

  it('advances after the exact pitch is played', () => {
    const manager = new LessonStateManager([{ id: 'a', notes: ['C4'], timestampMs: 100, durationMs: 50 }]);
    manager.updateTicks(100, []);
    manager.updateTicks(20, ['C4']);
    expect(manager.currentTargetIndex).toBe(1);
    expect(manager.activeNotes[0].state).toBe('CORRECT');
    expect(manager.currentLessonTimeMs).toBe(120);
  });

  it('accepts a complete three-note chord even with an extra detected resonance', () => {
    const manager = new LessonStateManager([{ id: 'a', notes: ['C4', 'E4', 'G4'], timestampMs: 100, durationMs: 50 }]);
    manager.updateTicks(100, []);
    manager.updateTicks(20, ['C4', 'E4', 'G4', 'B4']);
    expect(manager.currentTargetIndex).toBe(1);
    expect(manager.activeNotes[0].state).toBe('CORRECT');
  });

  it('reports first-try accuracy after a corrected mistake', () => {
    const manager = new LessonStateManager([
      { id: 'a', notes: ['C4'], timestampMs: 100, durationMs: 50 },
      { id: 'b', notes: ['D4'], timestampMs: 200, durationMs: 50 },
    ]);
    manager.updateTicks(100, []);
    manager.updateTicks(10, ['E4']);
    manager.updateTicks(10, ['C4']);
    manager.updateTicks(80, []);
    manager.updateTicks(10, ['D4']);
    expect(manager.successRate).toBe(50);
    expect(manager.missedCount).toBe(1);
  });

  it('passes rests automatically without lowering accuracy', () => {
    const manager = new LessonStateManager([
      { id: 'rest', notes: [], timestampMs: 100, durationMs: 100, isRest: true },
      { id: 'note', notes: ['C4'], timestampMs: 200, durationMs: 100 },
    ]);
    manager.updateTicks(100, []);
    manager.updateTicks(100, []);
    manager.updateTicks(10, ['C4']);
    expect(manager.currentTargetIndex).toBe(2);
    expect(manager.successRate).toBe(100);
    expect(manager.playableCount).toBe(1);
  });
});
