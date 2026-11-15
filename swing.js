// The hero's toy: the game's one move, small enough to try before you buy it. It swings by
// itself; hold anywhere on it (or hold Space) to grab the next bar, let go to fly. Five seconds
// after you stop, it carries on alone. With Reduce Motion it draws one still frame and stops.
(() => {
  const canvas = document.getElementById("swing");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const GRAVITY = 1500, REACH = 255, SPACING = 240, TOP_SPEED = 760;
  // Where the ball rides across the view: on a wide screen it keeps to the right, clear of the title.
  let vw = 0, vh = 0, scale = 1, lead = 0.36, top = 0.26, edge = 22;
  const bars = new Map();
  const ball = { x: 0, y: 0, vx: 0, vy: 0 };
  let rope = null, cam = 0, time = 0, last = 0, visible = true;
  let holding = false, yoursUntil = -1;
  const trail = [];

  const barY = i => vh * top + Math.sin(i * 1.7) * vh * 0.04 + Math.sin(i * 0.45) * vh * 0.03;
  function bar(i) {
    let b = bars.get(i);
    if (!b) { b = { i, x: i * SPACING, y: barY(i), gone: -1 }; bars.set(i, b); }
    return b;
  }

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const box = canvas.getBoundingClientRect();
    canvas.width = Math.round(box.width * dpr);
    canvas.height = Math.round(box.height * dpr);
    // On a phone the title takes the lower half, so the toy is smaller and plays higher up,
    // and the beam hugs the edge instead of running through the words.
    const narrow = box.width <= 900;
    scale = Math.min(1.35, Math.max(0.7, box.height / 760)) * (narrow ? 0.8 : 1);
    vw = box.width / scale;
    vh = box.height / scale;
    lead = narrow ? 0.4 : 0.68;
    top = narrow ? 0.2 : 0.26;
    edge = narrow ? 4 : 22;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    bars.clear();
    start();
  }

  // Hang the ball from a bar a little way into the view, drawn back and ready to swing.
  function start() {
    const b = bar(Math.round((cam + vw * (lead - 0.02)) / SPACING));
    b.gone = -1;
    rope = { bar: b, len: 170 };
    ball.x = b.x - Math.sin(0.95) * 170;
    ball.y = b.y + Math.cos(0.95) * 170;
    ball.vx = ball.vy = 0;
    trail.length = 0;
  }

  function nextBar(reach = REACH) {
    const from = Math.floor(ball.x / SPACING);
    let best = null, bestD = reach;
    for (let i = from; i <= from + 2; i++) {
      const b = bar(i);
      if (b.gone >= 0 || b.x < ball.x + 12) continue;
      const d = Math.hypot(b.x - ball.x, b.y - ball.y);
      if (d < bestD) { best = b; bestD = d; }
    }
    return best ? { bar: best, len: Math.max(110, bestD) } : null;
  }

  function step(dt) {
    time += dt;
    const yours = time < yoursUntil;
    if (rope) {
      const angle = Math.atan2(ball.x - rope.bar.x, ball.y - rope.bar.y);   // 0 hangs straight down
      const letGo = yours ? !holding : angle > 0.74 && ball.vy < 0;
      if (letGo) { rope.bar.gone = time; rope = null; }
    } else if (yours) {
      if (holding) rope = nextBar();
    } else {
      // By itself it grabs on the way down, or sooner if the bar is about to slip out of reach.
      // (It reaches a little further than you can, so the demo never drops itself.)
      const next = nextBar(REACH + 70);
      if (next && (ball.vy > 60 || next.len > REACH - 30)) rope = next;
    }

    ball.vy += GRAVITY * dt;
    if (rope) {
      // The pump: a swing going forward gains a little, as in the game.
      const speed = Math.hypot(ball.vx, ball.vy);
      if (ball.vx > 0 && speed < TOP_SPEED) { const k = 1 + 1.1 * dt; ball.vx *= k; ball.vy *= k; }
      rope.len = Math.max(118, rope.len - 34 * dt);
    }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (rope) {
      const dx = ball.x - rope.bar.x, dy = ball.y - rope.bar.y, d = Math.hypot(dx, dy) || 1;
      if (d > rope.len) {
        const nx = dx / d, ny = dy / d;
        ball.x = rope.bar.x + nx * rope.len;
        ball.y = rope.bar.y + ny * rope.len;
        const out = ball.vx * nx + ball.vy * ny;
        if (out > 0) { ball.vx -= out * nx; ball.vy -= out * ny; }
      }
    }
    if (ball.y > vh + 90 || ball.x < cam - 60) start();

    cam += (ball.x - vw * lead - cam) * Math.min(1, dt * 4);
    trail.push(ball.x, ball.y);
    if (trail.length > 56) trail.splice(0, 2);
    for (const [i, b] of bars) if (b.x < cam - 200) bars.delete(i);
  }

  function draw() {
    ctx.clearRect(0, 0, vw, vh);
    ctx.save();
    ctx.translate(-cam, 0);

    // The collapse: always just in frame, always coming.
    const bx = cam + edge + Math.sin(time * 9) * 3;
    const heat = ctx.createLinearGradient(bx - 4, 0, bx + (edge < 10 ? 70 : 150), 0);
    heat.addColorStop(0, "rgba(255,122,61,0.34)");
    heat.addColorStop(1, "rgba(255,122,61,0)");
    ctx.fillStyle = heat;
    ctx.fillRect(cam - 10, 0, 170, vh);
    ctx.shadowColor = "#ff7a3d";
    ctx.shadowBlur = 22;
    ctx.strokeStyle = "#fff1d6";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let y = 0; y <= vh; y += 24) ctx.lineTo(bx + Math.sin(y * 0.031 + time * 5) * 5, y);
    ctx.stroke();

    // Bars: a bar you leave breaks and fades.
    const first = Math.floor(cam / SPACING) - 1, lastBar = Math.ceil((cam + vw) / SPACING) + 1;
    ctx.shadowColor = "#3be8ff";
    for (let i = first; i <= lastBar; i++) {
      const b = bar(i);
      const fade = b.gone < 0 ? 1 : Math.max(0, 1 - (time - b.gone) / 0.35);
      if (fade <= 0) continue;
      ctx.globalAlpha = fade;
      ctx.shadowBlur = 16;
      ctx.fillStyle = "#c9f8ff";
      const drop = b.gone < 0 ? 0 : (time - b.gone) * 60;
      ctx.beginPath();
      ctx.roundRect(b.x - 24, b.y - 4 + drop, 48, 8, 4);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // The trail.
    ctx.lineCap = "round";
    for (let i = 2; i < trail.length; i += 2) {
      const t = i / trail.length;
      ctx.strokeStyle = `rgba(59,232,255,${0.5 * t * t})`;
      ctx.lineWidth = 1 + 7 * t;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(trail[i - 2], trail[i - 1]);
      ctx.lineTo(trail[i], trail[i + 1]);
      ctx.stroke();
    }

    // The tether.
    if (rope) {
      ctx.shadowBlur = 12;
      ctx.strokeStyle = "#eafdff";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(rope.bar.x, rope.bar.y);
      ctx.lineTo(ball.x, ball.y);
      ctx.stroke();
    }

    // The character: a steel ring in four pieces round a core of light.
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#3be8ff";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#f2feff";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#aebdd2";
    ctx.lineWidth = 4.5;
    ctx.lineCap = "butt";
    const spin = time * 2.2;
    for (let q = 0; q < 4; q++) {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 13, spin + q * Math.PI / 2 + 0.2, spin + (q + 1) * Math.PI / 2 - 0.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function frame(now) {
    if (!visible) { last = 0; return; }
    const dt = Math.min(1 / 30, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    step(dt / 2);
    step(dt / 2);
    draw();
    requestAnimationFrame(frame);
  }

  function press(down) {
    holding = down;
    yoursUntil = time + 5;
  }
  canvas.addEventListener("pointerdown", e => {
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    press(true);
  });
  canvas.addEventListener("pointerup", () => press(false));
  canvas.addEventListener("pointercancel", () => press(false));
  addEventListener("keydown", e => { if (e.code === "Space" && !e.repeat && document.activeElement === canvas) { e.preventDefault(); press(true); } });
  addEventListener("keyup", e => { if (e.code === "Space" && document.activeElement === canvas) press(false); });

  addEventListener("resize", size);
  size();
  if (still) {
    for (let i = 0; i < 70; i++) step(1 / 120);
    draw();
    return;
  }
  new IntersectionObserver(entries => {
    const now = entries[0].isIntersecting && !document.hidden;
    if (now && !visible) { visible = true; requestAnimationFrame(frame); }
    visible = now;
  }).observe(canvas);
  document.addEventListener("visibilitychange", () => {
    const now = !document.hidden;
    if (now && !visible) { visible = true; requestAnimationFrame(frame); }
    visible = now;
  });
  requestAnimationFrame(frame);
})();
