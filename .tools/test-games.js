// Checks the mini games' rules, not their looks:  node .tools/test-games.js
//
// Run it after touching any level parameter. It proves that every drone level
// can be landed, that every caliper reading is readable, and that every PID
// level is passable and still teaches the control term its hint names.
const path = require('path');
const G = (n) => require(path.join(__dirname, '..', 'assets', 'js', 'games', n + '.js'));
let failed = 0;
const check = (ok, msg) => { console.log((ok ? '  ok    ' : '  FAIL  ') + msg); if (!ok) failed++; };

// ---------------------------------------------------------------- drone
console.log('Soft Landing');
{
  const C = G('drone'), STEP = 1 / 120;
  const fly = (n, seed) => {
    const L = C.makeLevel(n, C.rng(seed)), s = C.spawn(L), inp = {};
    const margin = L.padW / 2 - C.FOOT;
    while (s.state === 'flying' && s.t < 90) {
      const alt = s.y - C.LEG, dx = L.padX - s.x, over = Math.abs(dx) < margin * 0.6;
      const tvx = Math.max(-7, Math.min(7, 0.7 * dx)) * (alt < 4 ? 0.4 : 1);
      inp.right = s.vx < tvx - 0.25; inp.left = s.vx > tvx + 0.25;
      const tvy = over ? -Math.max(1, Math.min(7, 0.35 * alt + 0.8)) : Math.max(-4, Math.min(4, 0.8 * (18 - alt)));
      inp.thrust = s.vy < tvy;
      C.step(s, L, inp, STEP);
    }
    return s;
  };
  for (const n of [1, 3, 6, 9, 12]) {
    let ok = 0; for (let k = 0; k < 100; k++) if (fly(n, 1000 + 31 * k + n).state === 'landed') ok++;
    check(ok >= 95, `level ${n}: a plain autopilot lands ${ok}/100 random layouts`);
  }
  const hover = 100 / (C.DRAIN_THRUST * C.G / C.THRUST + C.DRAIN_IDLE);   // hovering means thrusting g/THRUST of the time
  check(hover > 25, `a full battery hovers for ${hover.toFixed(0)} s`);
}

// ---------------------------------------------------------------- caliper
console.log('Read the Caliper');
{
  const C = G('caliper'); let bad = 0, n = 0;
  for (const key of Object.keys(C.MODES)) {
    const m = C.MODES[key];
    for (let whole = 0; whole <= C.MAX; whole++) for (let k = 0; k < m.n; k++) {
      const r = { whole, k }, al = C.aligned(r, m), want = k === 0 ? [0, m.n] : [k];
      if (JSON.stringify(al) !== JSON.stringify(want)) bad++;
      for (let j = 0; j <= m.n; j++) if (!al.includes(j)) {
        const p = C.vernierPos(r, m, j);
        if (Math.min(p - Math.floor(p), Math.ceil(p) - p) < 1 / m.n - 1e-9) bad++;
      }
      if (!C.check(r, m, C.value(r, m)) || C.check(r, m, C.value(r, m) + 1 / m.n)) bad++;
      n++;
    }
  }
  check(bad === 0, `all ${n} readings: exactly the right vernier line aligns, every other misses by a full least count`);
}

// ---------------------------------------------------------------- PID
console.log('Tune the Loop');
{
  const C = G('pid');
  const grid = (L, noI, noD) => {
    const g = (r, k) => Array.from({ length: k }, (_, i) => r[0] + (r[1] - r[0]) * i / (k - 1));
    let pass = 0, three = 0, total = 0;
    for (const kp of g(L.kp, 21)) for (const ki of noI ? [0] : g(L.ki, 16)) for (const kd of noD ? [0] : g(L.kd, 16)) {
      const m = C.simulate(L, kp, ki, kd).m; total++; if (m.pass) pass++; if (m.stars === 3) three++;
    }
    return { pass, three, total };
  };
  // the term each level is about: without it, nothing on the grid may pass
  const lesson = { 1: ['I'], 2: ['D'], 3: ['I', 'D'], 4: ['D'] };
  for (const L of C.LEVELS) {
    const full = grid(L);
    check(full.pass > 0 && full.three > 0, `level ${L.id}: passable (${full.pass}/${full.total}), three stars reachable (${full.three})`);
    check(!C.simulate(L, ...L.init).m.pass, `level ${L.id}: the starting gains fail`);
    for (const term of lesson[L.id]) {
      const r = grid(L, term === 'I', term === 'D');
      check(r.pass === 0, `level ${L.id}: nothing passes without the ${term} term`);
    }
  }
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
