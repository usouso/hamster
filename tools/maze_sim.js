// maze.html の中の遊びを、画面なし（Node）で動かす（確かめ用。ゲームには含めない）
//   使い方：node tools/maze_sim.js [mode] [n] [until] [seed0]   例：node tools/maze_sim.js normal 100 end 1000
//   画面・音・入力は、からの受け皿（スタブ）にして、遊びの中身（update・ボット）だけを 1/60 秒ずつ進める
//   音の時計（AudioContext.currentTime）は、ゲームの時計に合わせて進む「にせの時計」。音は鳴らさないが、音の予約の時刻は本物と同じ
const fs = require('fs'), vm = require('vm'), path = require('path');
function stub(store = {}) {   // どんな名前で呼んでも、だいたい大丈夫な受け皿
  return new Proxy(store, {
    get(t, k) {
      if (k === 'then') return undefined;
      if (k in t) return t[k];
      if (k === 'addColorStop' || k === 'connect' || k === 'disconnect' || k === 'start' || k === 'stop') return () => {};
      return (...a) => (k === 'getContext' || k === 'createElement' || k.startsWith('create') ? stub() : k === 'getChannelData' ? new Float32Array(a[0] || 0) : k === 'measureText' ? { width: 0 } : k === 'resume' || k === 'suspend' ? Promise.resolve() : undefined);
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
function makeDom(opts) {
  const els = {};
  const el = id => els[id] || (els[id] = stub({ id, hidden: false, style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, addEventListener() {}, appendChild() {}, setPointerCapture() {}, closest() { return null; } }));
  const sb = {
    console, Math, JSON, Date, Number, String, Array, Object, Map, Set, Promise, Int16Array, Int32Array, Uint8Array, Float32Array, Error, Infinity, NaN, isFinite, isNaN, parseInt, parseFloat, RegExp,
    URLSearchParams, setTimeout: () => 1, clearTimeout: () => {}, setInterval: () => 1, clearInterval: () => {},
    requestAnimationFrame: () => 0, performance: { now: () => Date.now() },
    innerWidth: opts.w || 1280, innerHeight: opts.h || 800, devicePixelRatio: 1,
    location: { search: opts.search || '' }, navigator: { userAgent: 'node', maxTouchPoints: 0 }, matchMedia: () => ({ matches: !!opts.touch }), screen: {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    document: { getElementById: el, createElement: () => stub({ width: 0, height: 0, style: {} }), addEventListener() {}, hidden: false, body: { style: {} } },
    Path2D: class { rect() {} moveTo() {} lineTo() {} arc() {} closePath() {} },
    __simT: 100,
  };
  sb.AudioContext = class {
    constructor() { this.state = 'running'; this.sampleRate = 48000; this.destination = stub(); this.outputLatency = 0; this.baseLatency = 0; }
    get currentTime() { return sb.__simT; }
    resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); }
    createBuffer(ch, n) { return { getChannelData: () => new Float32Array(n) }; }
  };
  for (const k of ['createGain', 'createOscillator', 'createBiquadFilter', 'createDynamicsCompressor', 'createBufferSource', 'createWaveShaper', 'createStereoPanner']) sb.AudioContext.prototype[k] = () => stub({ gain: stub(), frequency: stub(), detune: stub(), Q: stub(), pan: stub() });
  sb.window = sb; sb.globalThis = sb; sb.self = sb;
  return sb;
}
function load(opts = {}) {
  const html = fs.readFileSync(opts.file || path.join(__dirname, '..', 'maze.html'), 'utf8');
  const src = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const sb = makeDom(opts);
  vm.createContext(sb);
  vm.runInContext(src, sb, { filename: 'maze.html' });
  return { ev: code => vm.runInContext(code, sb), sb, run: (mode, o = {}) => vm.runInContext(`simulate(${JSON.stringify(mode)}, ${JSON.stringify(o)})`, sb) };
}
module.exports = { load };
if (require.main === module) {
  const [mode = 'normal', n = '3', until = 'end', seed0 = '1000', cfg = '{}'] = process.argv.slice(2);
  const out = [];
  for (let i = 0; i < +n; i++) {
    const g = load({ search: `?seed=${+seed0 + i}` });
    const C = JSON.parse(cfg); if (Object.keys(C).length) g.ev(`Object.assign(C, ${JSON.stringify(C)})`);
    const r = g.run(mode, { until });
    out.push(r); process.stdout.write(JSON.stringify(r) + '\n');
  }
}
