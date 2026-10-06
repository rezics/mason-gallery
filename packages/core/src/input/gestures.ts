/** One navigation per gesture; ignore its inertia until the device goes quiet. */
export class WheelNavigationGate {
  private lastEvent = -Infinity;
  private lastAction = -Infinity;
  private accumulated = 0;
  private fired = false;
  consume(delta: number, now: number, animationMs: number): boolean {
    if (now - this.lastEvent > 180) {
      this.accumulated = 0;
      this.fired = false;
    }
    this.lastEvent = now;
    if (this.fired || now - this.lastAction < animationMs) return false;
    if (Math.sign(delta) !== Math.sign(this.accumulated)) this.accumulated = 0;
    this.accumulated += delta;
    if (Math.abs(this.accumulated) < 40) return false;
    this.fired = true;
    this.lastAction = now;
    return true;
  }
}
export function normalizeWheelDelta(
  delta: number,
  mode: number,
  pageHeight: number,
): number {
  return delta * (mode === 1 ? 16 : mode === 2 ? pageHeight : 1);
}
export class PointerClickTracker {
  private start: { id: number; x: number; y: number; moved: boolean } | null =
    null;
  down(id: number, x: number, y: number) {
    this.start = { id, x, y, moved: false };
  }
  move(id: number, x: number, y: number) {
    if (
      this.start?.id === id &&
      Math.hypot(x - this.start.x, y - this.start.y) > 8
    )
      this.start.moved = true;
  }
  up(id: number, x: number, y: number): boolean {
    this.move(id, x, y);
    const clicked = this.start?.id === id && !this.start.moved;
    this.start = null;
    return clicked;
  }
  cancel() {
    this.start = null;
  }
}
