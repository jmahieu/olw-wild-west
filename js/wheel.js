// === Spinning Wheel (Canvas) ===

class SpinningWheel {
  constructor(canvasId, items) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.items = items;
    this.angle = 0;
    this.angularVelocity = 0;
    this.spinning = false;
    this.stopping = false;
    this.friction = 0.988;
    this.onResult = null;
    this.lastSegment = -1;
    this.tickSound = null;

    this.resize();
    this.draw();
  }

  resize() {
    const size = Math.min(this.canvas.parentElement.offsetWidth - 40, 600);
    this.canvas.width = size;
    this.canvas.height = size;
    this.cx = size / 2;
    this.cy = size / 2;
    this.radius = size / 2 - 10;
    this.draw();
  }

  setItems(items) {
    this.items = items;
    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    const n = this.items.length;
    if (n === 0) return;

    const sliceAngle = (2 * Math.PI) / n;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw segments
    for (let i = 0; i < n; i++) {
      const startAngle = this.angle + i * sliceAngle;
      const endAngle = startAngle + sliceAngle;
      const item = this.items[i];

      // Segment fill
      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy);
      ctx.arc(this.cx, this.cy, this.radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = item.color || '#8B4513';
      ctx.fill();

      // Segment border
      ctx.strokeStyle = '#3E2723';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Text
      ctx.save();
      ctx.translate(this.cx, this.cy);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${Math.max(11, Math.min(16, 200 / n))}px Vollkorn, serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 3;

      const textRadius = this.radius * 0.65;
      const text = item.icon + ' ' + item.name;
      ctx.fillText(text, textRadius, 5);
      ctx.restore();
    }

    // Center circle
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, 30, 0, 2 * Math.PI);
    ctx.fillStyle = '#3E2723';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, 25, 0, 2 * Math.PI);
    ctx.fillStyle = '#DAA520';
    ctx.fill();

    // Star in center
    ctx.fillStyle = '#3E2723';
    ctx.font = 'bold 20px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', this.cx, this.cy);
  }

  spin() {
    if (this.spinning) return;
    this.angularVelocity = 0.25 + Math.random() * 0.15;
    this.spinning = true;
    this.stopping = false;
    this.animate();
  }

  stop() {
    if (!this.spinning || this.stopping) return;
    this.stopping = true;
    // Add randomness to the deceleration
    this.angularVelocity *= (0.35 + Math.random() * 0.35);
  }

  animate() {
    if (!this.spinning) return;

    this.angle += this.angularVelocity;

    if (this.stopping) {
      this.angularVelocity *= this.friction;
    }

    // Tick sound on segment cross
    const n = this.items.length;
    if (n > 0) {
      const sliceAngle = (2 * Math.PI) / n;
      const currentSegment = Math.floor((((-this.angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / sliceAngle);
      if (currentSegment !== this.lastSegment) {
        this.lastSegment = currentSegment;
        this.playTick();
      }
    }

    // Check if stopped
    if (this.stopping && this.angularVelocity < 0.0008) {
      this.spinning = false;
      this.stopping = false;
      this.draw();
      const result = this.getResult();
      if (this.onResult) {
        this.onResult(result);
      }
      return;
    }

    this.draw();
    requestAnimationFrame(() => this.animate());
  }

  getResult() {
    const n = this.items.length;
    if (n === 0) return null;
    const sliceAngle = (2 * Math.PI) / n;
    // The pointer is at the top (angle 0 = 3 o'clock, so top = -PI/2)
    // We need to find which segment is at the top
    const pointerAngle = -Math.PI / 2;
    const normalizedAngle = ((pointerAngle - this.angle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const segmentIndex = Math.floor(normalizedAngle / sliceAngle);
    return this.items[segmentIndex % n];
  }

  playTick() {
    try {
      const audioCtx = window._wheelAudioCtx || (window._wheelAudioCtx = new AudioContext());
      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      oscillator.connect(gain);
      gain.connect(audioCtx.destination);
      oscillator.frequency.value = 800 + Math.random() * 200;
      oscillator.type = 'square';
      gain.gain.value = 0.05;
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.05);
    } catch (e) {}
  }
}
