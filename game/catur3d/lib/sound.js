let ctx = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone({ freq, type = "sine", dur = 0.12, gain = 0.16, slideTo, delay = 0 }) {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const Sound = {
  select(enabled) {
    if (!enabled) return;
    tone({ freq: 520, type: "triangle", dur: 0.06, gain: 0.07 });
  },
  move(enabled) {
    if (!enabled) return;
    tone({ freq: 260, slideTo: 180, type: "sine", dur: 0.1, gain: 0.15 });
    tone({ freq: 900, type: "square", dur: 0.03, gain: 0.03 });
  },
  capture(enabled) {
    if (!enabled) return;
    tone({ freq: 200, slideTo: 90, type: "sawtooth", dur: 0.16, gain: 0.14 });
    tone({ freq: 420, slideTo: 240, type: "triangle", dur: 0.12, gain: 0.08 });
  },
  castle(enabled) {
    if (!enabled) return;
    tone({ freq: 300, slideTo: 340, type: "sine", dur: 0.08, gain: 0.12 });
    tone({ freq: 340, slideTo: 300, type: "sine", dur: 0.08, gain: 0.12, delay: 0.09 });
  },
  promote(enabled) {
    if (!enabled) return;
    [523, 659, 784, 1046].forEach((f, i) =>
      tone({ freq: f, type: "triangle", dur: 0.14, gain: 0.1, delay: i * 0.07 }),
    );
  },
  check(enabled) {
    if (!enabled) return;
    tone({ freq: 880, type: "square", dur: 0.1, gain: 0.09 });
    tone({ freq: 1180, type: "square", dur: 0.12, gain: 0.09, delay: 0.1 });
  },
  gameOver(enabled) {
    if (!enabled) return;
    [660, 550, 440, 330].forEach((f, i) =>
      tone({ freq: f, type: "sine", dur: 0.22, gain: 0.11, delay: i * 0.13 }),
    );
  },
};
