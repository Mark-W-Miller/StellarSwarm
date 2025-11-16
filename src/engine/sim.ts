type TickHandler = (dt: number, elapsed: number) => void;

export class GameSim {
  private lastTime = performance.now();
  private elapsed = 0;
  private handlers: TickHandler[] = [];
  private running = false;

  onTick(handler: TickHandler) {
    this.handlers.push(handler);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
  }

  private tick = (time: number) => {
    if (!this.running) return;
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    this.elapsed += dt;
    this.handlers.forEach((handler) => handler(dt, this.elapsed));
    requestAnimationFrame(this.tick);
  };
}
