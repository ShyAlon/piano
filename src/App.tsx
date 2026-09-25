import { useCallback, useEffect, useRef, useState } from 'react';
import { startAudioSession, type AudioSession } from './audio';
import { LessonStateManager, TUNES, type Tune } from './lesson';
import { PitchDetector, type DetectedTone } from './pitch-detector';
import { PianoCanvasRenderer } from './renderer';
import { NOTE_NAMES, type NoteName } from './types';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<AudioSession | null>(null);
  const detectorRef = useRef<PitchDetector | null>(null);
  const pressedRef = useRef<Set<NoteName>>(new Set());
  const microphoneNotesRef = useRef<NoteName[]>([]);
  const speedRef = useRef(100);
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<'select' | 'practice' | 'results'>('select');
  const [selectedTune, setSelectedTune] = useState<Tune>(TUNES[0]);
  const [manager, setManager] = useState(() => new LessonStateManager(TUNES[0].notes));
  const [audioError, setAudioError] = useState('');
  const [waitMode, setWaitMode] = useState(true);
  const [speed, setSpeed] = useState(100);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [detectedTones, setDetectedTones] = useState<DetectedTone[]>([]);
  const [noteTooltip, setNoteTooltip] = useState<{ label: string; x: number; y: number } | null>(null);
  const [snapshot, setSnapshot] = useState({ time: 0, target: 0 });

  const begin = useCallback(async () => {
    setAudioError('');
    try {
      audioRef.current = await startAudioSession();
      detectorRef.current = new PitchDetector(audioRef.current.analyser, audioRef.current.context.sampleRate);
    } catch {
      setAudioError('Microphone access is unavailable. The practice simulator still works.');
    }
    setStarted(true);
  }, []);

  useEffect(() => () => audioRef.current?.stop(), []);

  useEffect(() => {
    if (!started || phase !== 'practice' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const renderer = new PianoCanvasRenderer(canvas);
    const resize = () => renderer.resize(canvas.clientWidth, canvas.clientHeight);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let animationFrame = 0;
    let previous = performance.now();
    let lastUiUpdate = 0;
    let lastPitchUpdate = 0;
    const frame = (now: number) => {
      const delta = Math.min(now - previous, 50);
      previous = now;
      if (detectorRef.current && now - lastPitchUpdate > 55) {
        const tones = detectorRef.current.detect();
        microphoneNotesRef.current = tones.map((tone) => tone.note);
        setDetectedTones(tones);
        lastPitchUpdate = now;
      }
      const currentInput = new Set<NoteName>([...microphoneNotesRef.current, ...pressedRef.current]);
      manager.updateTicks(delta * (speedRef.current / 100), [...currentInput]);
      renderer.render(manager.activeNotes, manager.currentLessonTimeMs, manager.currentTargetIndex, microphoneNotesRef.current);
      if (manager.currentTargetIndex >= manager.activeNotes.length) {
        setSnapshot({ time: manager.currentLessonTimeMs, target: manager.currentTargetIndex });
        setPhase('results');
        return;
      }
      if (now - lastUiUpdate > 100) {
        setSnapshot({ time: manager.currentLessonTimeMs, target: manager.currentTargetIndex });
        lastUiUpdate = now;
      }
      animationFrame = requestAnimationFrame(frame);
    };
    animationFrame = requestAnimationFrame(frame);
    const inspectNote = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      setNoteTooltip(renderer.hitTest(event.clientX - bounds.left, event.clientY - bounds.top));
    };
    const clearTooltip = () => setNoteTooltip(null);
    canvas.addEventListener('pointermove', inspectNote);
    canvas.addEventListener('pointerdown', inspectNote);
    canvas.addEventListener('pointerleave', clearTooltip);
    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      canvas.removeEventListener('pointermove', inspectNote);
      canvas.removeEventListener('pointerdown', inspectNote);
      canvas.removeEventListener('pointerleave', clearTooltip);
    };
  }, [started, phase, manager]);

  const setNote = (note: NoteName, active: boolean) => {
    if (active) pressedRef.current.add(note);
    else pressedRef.current.delete(note);
  };

  const toggleWaitMode = () => {
    const next = !waitMode;
    setWaitMode(next);
    manager.setWaitMode(next);
  };

  const changeSpeed = (nextSpeed: number) => {
    speedRef.current = nextSpeed;
    setSpeed(nextSpeed);
  };

  const restart = () => {
    pressedRef.current.clear();
    manager.reset();
    setSnapshot({ time: 0, target: 0 });
  };

  const chooseTune = (tune: Tune) => {
    const nextManager = new LessonStateManager(tune.notes);
    nextManager.setWaitMode(waitMode);
    pressedRef.current.clear();
    microphoneNotesRef.current = [];
    setDetectedTones([]);
    setSelectedTune(tune);
    setManager(nextManager);
    setSnapshot({ time: 0, target: 0 });
    setPhase('practice');
  };

  const returnToTunes = () => {
    pressedRef.current.clear();
    microphoneNotesRef.current = [];
    setDetectedTones([]);
    setPhase('select');
  };

  const current = manager.activeNotes[snapshot.target];
  const complete = snapshot.target >= manager.activeNotes.length;
  const lyricWindow = manager.activeNotes
    .slice(Math.max(0, snapshot.target - 1), snapshot.target + 5)
    .filter((note) => note.lyric);

  return (
    <main className="app-shell">
      <header>
        <div className="brand">
          <button className="brand-mark" onClick={() => setTutorialOpen(true)} aria-label="Open practice tutorial">PT</button>
          <div><h1>Piano Trainer</h1><p>Listen. Play. Progress.</p></div>
        </div>
        <div className="status-row">
          <span className={`pill ${current?.state === 'WRONG' ? 'warn' : ''}`}>
            {complete ? 'Lesson complete' : current?.state === 'WRONG' ? 'Waiting for you' : 'Playing'}
          </span>
          <button className={`mode-toggle ${waitMode ? 'active' : ''}`} onClick={toggleWaitMode} aria-pressed={waitMode}>
            Wait mode <span>{waitMode ? 'On' : 'Off'}</span>
          </button>
          <button className="icon-button" onClick={restart} aria-label="Restart lesson">↻</button>
        </div>
      </header>

      <section className="stage" aria-label="Scrolling lesson timeline">
        <canvas ref={canvasRef} />
        <div className="hit-label">PLAY HERE</div>
        <div className="lyric-strip" aria-live="polite">
          {lyricWindow.map((note) => (
            <span key={note.id} className={note.id === current?.id ? 'current' : ''}>{note.lyric}</span>
          ))}
        </div>
        <div className="lesson-readout">
          <span>{selectedTune.title}</span>
          <strong>{complete ? 'Done' : current?.isRest ? 'Rest' : current?.notes.join(' + ')}</strong>
        </div>
        <div className={`tone-monitor ${detectedTones.length ? 'is-listening' : ''}`} aria-live="polite">
          <div className="tone-pulse"><i /><i /><i /></div>
          <div className="tone-copy">
            <span>{detectedTones.length > 1 ? 'CHORD DETECTED' : detectedTones.length ? 'TONE DETECTED' : 'LISTENING'}</span>
            <div className="tone-values">
              {detectedTones.length ? detectedTones.map((tone) => (
                <strong key={tone.note} style={{ '--tone-strength': tone.strength } as React.CSSProperties}>
                  {tone.note}<small>{tone.cents === 0 ? 'in tune' : `${tone.cents > 0 ? '+' : ''}${tone.cents}¢`}</small>
                </strong>
              )) : <em>Play your piano…</em>}
            </div>
          </div>
        </div>
        {noteTooltip && (
          <div className="note-tooltip" style={{ left: noteTooltip.x, top: noteTooltip.y }} role="tooltip">
            {noteTooltip.label}
          </div>
        )}
      </section>

      <section className="controls">
        <div className="progress-copy">
          <span>Progress</span>
          <strong>{Math.min(snapshot.target, manager.activeNotes.length)} / {manager.activeNotes.length}</strong>
        </div>
        <label className="speed-control">
          <span className="speed-heading">Speed <strong>{speed}%</strong></span>
          <span className="speed-track">
            <input
              type="range"
              min="50"
              max="200"
              step="25"
              value={speed}
              onChange={(event) => changeSpeed(Number(event.target.value))}
              aria-label="Lesson speed"
            />
            <span className="speed-notches" aria-hidden="true">
              {[50, 75, 100, 125, 150, 175, 200].map((value) => <i key={value} />)}
            </span>
          </span>
          <span className="speed-labels"><small>50%</small><small>100%</small><small>200%</small></span>
        </label>
        <div className="keyboard" aria-label="Mock pitch input">
          {NOTE_NAMES.map((note) => (
            <button
              key={note}
              className={note.includes('#') ? 'black-key' : 'white-key'}
              onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setNote(note, true); }}
              onPointerUp={() => setNote(note, false)}
              onPointerCancel={() => setNote(note, false)}
              onPointerLeave={(event) => { if (event.buttons === 0) setNote(note, false); }}
            >{note}</button>
          ))}
        </div>
        <p className="hint">Press and hold the highlighted pitch—or all chord notes—when it reaches the line.</p>
      </section>

      {!started && (
        <div className="splash">
          <div className="splash-card">
            <span className="splash-icon">♪</span>
            <p className="eyebrow">ACOUSTIC PIANO TRAINER</p>
            <h2>Tap to Start Practice</h2>
            <p>We’ll enable your microphone, then guide each note to the line. Your sound stays on this device.</p>
            <button onClick={begin}>Start practice <span>→</span></button>
            {audioError && <p role="alert" className="error">{audioError}</p>}
          </div>
        </div>
      )}
      {started && audioError && <div className="toast" role="status">{audioError}</div>}

      {started && phase === 'select' && (
        <div className="selection-screen">
          <div className="selection-content">
            <p className="eyebrow">CHOOSE A SONG</p>
            <h2>What shall we play?</h2>
            <p className="selection-intro">Pick a familiar tune and place your iPad near the piano.</p>
            <div className="tune-grid">
              {TUNES.map((tune) => (
                <button key={tune.id} className="tune-card" onClick={() => chooseTune(tune)}>
                  <span className="tune-icon">{tune.icon}</span>
                  <span className="tune-info"><strong>{tune.title}</strong><small>{tune.subtitle}</small></span>
                  <span className={`difficulty ${tune.difficulty.toLowerCase()}`}>{tune.difficulty}</span>
                  <span className="tune-arrow">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {started && phase === 'results' && (
        <div className="results-screen">
          <section className="results-card">
            <div className="result-burst">★</div>
            <p className="eyebrow">SONG COMPLETE</p>
            <h2>{selectedTune.title}</h2>
            <div className="score-ring" style={{ '--score': `${manager.successRate * 3.6}deg` } as React.CSSProperties}>
              <div><strong>{manager.successRate}%</strong><span>success</span></div>
            </div>
            <p className="result-message">{manager.successRate >= 90 ? 'Wonderful playing!' : manager.successRate >= 70 ? 'Great progress—keep going!' : 'Every practice makes you stronger!'}</p>
            <div className="result-stats">
              <span><strong>{manager.playableCount}</strong> notes played</span>
              <span><strong>{manager.missedCount}</strong> first-try misses</span>
            </div>
            <button className="choose-again" onClick={returnToTunes}>Choose another tune</button>
            <button className="play-again" onClick={() => chooseTune(selectedTune)}>Play this tune again</button>
          </section>
        </div>
      )}

      {tutorialOpen && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setTutorialOpen(false)}>
          <section
            className="tutorial-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tutorial-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="dialog-close" onClick={() => setTutorialOpen(false)} aria-label="Close tutorial">×</button>
            <p className="eyebrow">HOW TO PRACTICE</p>
            <h2 id="tutorial-title">Meet each note at the line</h2>
            <p className="tutorial-intro">Set your iPad beside the piano in landscape orientation, then follow the notes from right to left.</p>
            <ol className="tutorial-steps">
              <li><span>1</span><div><strong>Allow microphone access</strong><p>Tap Start Practice and let the app use your iPad microphone.</p></div></li>
              <li><span>2</span><div><strong>Watch the play line</strong><p>The note name at the top is your next target. Play it when its circle reaches the coral line.</p></div></li>
              <li><span>3</span><div><strong>Use Wait mode</strong><p>With Wait mode on, the lesson pauses until the correct note or chord is recognized.</p></div></li>
            </ol>
            <div className="prototype-note">
              <span>LIVE LISTENING</span>
              <p>The microphone identifies single notes and chords from C4 through B4. A ±55-cent tolerance allows for an acoustic piano that is slightly out of tune. The on-screen keys remain available for testing.</p>
            </div>
            <button className="dialog-primary" onClick={() => setTutorialOpen(false)}>Got it — let’s practice</button>
          </section>
        </div>
      )}
    </main>
  );
}
