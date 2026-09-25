import { NOTE_NAMES, type NoteName, type RenderableNote } from './types';

export const SOLFEGE_NAMES: Record<NoteName, string> = {
  C4: 'Do',
  'C#4': 'Do♯',
  D4: 'Re',
  'D#4': 'Re♯',
  E4: 'Mi',
  F4: 'Fa',
  'F#4': 'Fa♯',
  G4: 'Sol',
  'G#4': 'Sol♯',
  A4: 'La',
  'A#4': 'La♯',
  B4: 'Si',
};

interface NoteHitArea {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  note: NoteName;
}

export class PianoCanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private hitLineX = 0;
  private readonly speedFactor = 0.28;
  private cssWidth = 0;
  private cssHeight = 0;
  private hitAreas: NoteHitArea[] = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D rendering is unavailable.');
    this.ctx = context;
  }

  public resize(width: number, height: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cssWidth = width;
    this.cssHeight = height;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.hitLineX = width * 0.2;
  }

  public render(notes: RenderableNote[], currentLessonTimeMs: number, targetIndex: number, heardNotes: NoteName[] = []) {
    const { ctx } = this;
    this.hitAreas = [];
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    this.drawBackground();
    this.drawHitLine();

    notes.forEach((note, index) => {
      note.xPosition = this.hitLineX + (note.timestampMs - currentLessonTimeMs) * this.speedFactor;
      if (note.xPosition < -70 || note.xPosition > this.cssWidth + 100) return;
      if (note.isRest) this.drawRest(note, index === targetIndex);
      else this.drawNoteNode(note, index === targetIndex);
    });
    this.drawHeardNotes(heardNotes);
  }

  public hitTest(x: number, y: number) {
    const hit = [...this.hitAreas].reverse().find((area) => {
      const dx = (x - area.x) / (area.radiusX + 7);
      const dy = (y - area.y) / (area.radiusY + 7);
      return dx * dx + dy * dy <= 1;
    });
    return hit ? { note: hit.note, label: `${SOLFEGE_NAMES[hit.note]} · ${hit.note}`, x: hit.x, y: hit.y } : null;
  }

  private drawBackground() {
    const gradient = this.ctx.createLinearGradient(0, 0, this.cssWidth, this.cssHeight);
    gradient.addColorStop(0, '#121622');
    gradient.addColorStop(1, '#0a0c13');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    this.ctx.strokeStyle = 'rgba(255,255,255,.055)';
    this.ctx.lineWidth = 1;
    NOTE_NAMES.forEach((_, index) => {
      const y = this.yForNote(NOTE_NAMES[index]);
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.cssWidth, y);
      this.ctx.stroke();
    });
  }

  private drawHitLine() {
    this.ctx.shadowColor = '#ff7355';
    this.ctx.shadowBlur = 18;
    this.ctx.strokeStyle = '#ff8268';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(this.hitLineX, 28);
    this.ctx.lineTo(this.hitLineX, this.cssHeight - 28);
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;
  }

  private drawNoteNode(note: RenderableNote, isTarget: boolean) {
    const color = note.state === 'CORRECT' ? '#50d890' : note.state === 'WRONG' ? '#ff625f' : '#68a8ff';
    const chordGap = 31;
    note.notes.forEach((pitch, pitchIndex) => {
      const y = this.yForNote(pitch) + (pitchIndex - (note.notes.length - 1) / 2) * chordGap;
      const radiusY = isTarget ? 28 : 24;
      const durationStretch = Math.max(0, Math.min(34, (note.durationMs - 600) * 0.027));
      const radiusX = radiusY + durationStretch;
      this.ctx.save();
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = isTarget ? 25 : 14;
      this.ctx.shadowOffsetY = 7;
      this.ctx.beginPath();
      this.ctx.ellipse(note.xPosition, y, radiusX, radiusY, 0, 0, Math.PI * 2);
      const gradient = this.ctx.createRadialGradient(
        note.xPosition - radiusX * 0.38,
        y - radiusY * 0.42,
        radiusY * 0.08,
        note.xPosition,
        y,
        radiusX,
      );
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.16, color);
      gradient.addColorStop(0.68, color);
      gradient.addColorStop(1, '#10192b');
      this.ctx.fillStyle = gradient;
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
      this.ctx.shadowOffsetY = 0;
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = 'rgba(255,255,255,.42)';
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.arc(note.xPosition - radiusX * 0.32, y - radiusY * 0.36, radiusY * 0.16, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(255,255,255,.72)';
      this.ctx.fill();
      this.ctx.fillStyle = '#07101e';
      this.ctx.font = `800 ${isTarget ? 13 : 11}px system-ui`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(pitch.replace('4', ''), note.xPosition, y + 0.5);
      this.ctx.restore();
      this.hitAreas.push({ x: note.xPosition, y, radiusX, radiusY, note: pitch });
    });
  }

  private drawRest(note: RenderableNote, isTarget: boolean) {
    const y = this.cssHeight / 2;
    const width = Math.max(42, Math.min(82, note.durationMs * 0.055));
    this.ctx.save();
    this.ctx.translate(note.xPosition, y);
    this.ctx.shadowColor = '#aeb7ca';
    this.ctx.shadowBlur = isTarget ? 18 : 8;
    this.ctx.fillStyle = isTarget ? '#eef1f7' : '#8791a7';
    this.ctx.beginPath();
    this.ctx.roundRect(-width / 2, -4, width, 8, 4);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;
    this.ctx.font = '800 13px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('REST', 0, -15);
    this.ctx.restore();
  }

  private drawHeardNotes(notes: NoteName[]) {
    notes.forEach((note, index) => {
      const y = this.yForNote(note);
      const radius = 18;
      this.ctx.save();
      this.ctx.translate(this.hitLineX, y);
      this.ctx.rotate(-Math.PI / 2);
      this.ctx.shadowColor = '#ffe372';
      this.ctx.shadowBlur = 22;
      this.ctx.beginPath();
      for (let point = 0; point < 10; point += 1) {
        const angle = -Math.PI / 2 + point * Math.PI / 5;
        const pointRadius = point % 2 === 0 ? radius : radius * 0.43;
        const x = Math.cos(angle) * pointRadius;
        const pointY = Math.sin(angle) * pointRadius;
        if (point === 0) this.ctx.moveTo(x, pointY);
        else this.ctx.lineTo(x, pointY);
      }
      this.ctx.closePath();
      const gradient = this.ctx.createRadialGradient(-5, -6, 1, 0, 0, radius);
      gradient.addColorStop(0, '#fffbd1');
      gradient.addColorStop(0.38, '#ffe372');
      gradient.addColorStop(1, '#ff8a47');
      this.ctx.fillStyle = gradient;
      this.ctx.fill();
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeStyle = '#fff8ba';
      this.ctx.stroke();
      this.ctx.restore();

      this.ctx.fillStyle = '#fff4b4';
      this.ctx.font = '800 9px system-ui';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(`${SOLFEGE_NAMES[note]}${notes.length > 1 ? ` ${index + 1}` : ''}`, this.hitLineX + 24, y);
    });
  }

  private yForNote(note: NoteName) {
    const index = NOTE_NAMES.indexOf(note);
    const top = 36;
    const available = this.cssHeight - top * 2;
    return top + available - (index / (NOTE_NAMES.length - 1)) * available;
  }
}
