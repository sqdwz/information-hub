export const DURATION = 5;
export const IDLE_PERIOD = 24;
export const STAGES = [
  { time: 0, label: '微光初醒', en: 'WHISPER', detail: '一缕微光，轻触指尖。' },
  { time: .6, label: '循发描形', en: 'DRAW', detail: '沿着发束与手指，慢慢描绘。' },
  { time: 1.8, label: '眉眼成形', en: 'CONTOUR', detail: '少量线条，勾勒熟悉的神情。' },
  { time: 2.8, label: '由线生色', en: 'REVEAL', detail: '光走过的地方，渐渐有了颜色。' },
  { time: 4, label: '光隐于形', en: 'RESOLVE', detail: '线条隐去，留下眼中的微光。' },
  { time: 5, label: '与光共生', en: 'ALIVE', detail: '欢迎来到，我的小小宇宙。' },
];
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const smooth = (a, b, t) => { const x = clamp((t-a)/(b-a)); return x*x*(3-2*x); };
export function evaluate(time) {
  const t = Math.max(0, Number.isFinite(time) ? time : 0);
  let stage = 0;
  for (let i = 1; i < STAGES.length; i++) if (t >= STAGES[i].time) stage = i;
  return {
    time: t, progress: clamp(t / DURATION), stage,
    contour: smooth(.6, 2.8, t) * (1 - smooth(3.5, 4.65, t)),
    material: smooth(2.8, 4.4, t),
    iris: smooth(3.54, 3.85, t), title: smooth(3.8, 4.8, t),
    idle: Math.max(0, t-DURATION),
  };
}
export function nextTime(time, dt, speed = 1) {
  // Wrap into an already-settled idle cycle, beyond its one-second entry envelope.
  const t = time + Math.max(0, dt) * speed;
  return t > DURATION + IDLE_PERIOD * 20 ? DURATION + IDLE_PERIOD + (t-DURATION) % IDLE_PERIOD : t;
}
