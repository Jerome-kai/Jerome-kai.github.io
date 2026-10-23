// Checks the mini games' rules, not their looks:  node .tools/test-games.js
//
// Run it after touching any level parameter. It proves that every drone level
// can be landed, that every caliper reading is readable, that every PID level
// is passable and still teaches the control term its hint names, that the gear
// levels' best counts are the true minimum and the drawn gears really mesh, that
// every Three Views drawing matches the block's projected edges, and that every
// logic level can be solved.
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

// ---------------------------------------------------------------- gears
console.log('Gear Train');
{
  const C = G('gears');
  for (const L of C.LEVELS) {
    const f = C.fewest(L);
    check(f && f.gears === L.best, `level ${L.id} (${L.rpm} rpm ${L.dir > 0 ? 'cw' : 'ccw'}): fewest gears ${f && f.gears}, as the level says (${L.best})`);
    check(!C.matches(C.evaluate(C.START), L), `level ${L.id}: the starting train does not already solve it`);
  }
  // Drawn gears: at every contact a tooth of one sits in a gap of the other, at
  // any angle, and the output shaft turns at exactly the computed speed.
  const wrap = (a, P) => ((a % P) + P + P / 2) % P - P / 2;
  let worst = 0, speed = 0, contacts = 0;
  for (let trial = 0; trial < 300; trial++) {
    const stages = [];
    for (let i = 0; i < 1 + trial % 3; i++) stages.push({ a: C.TEETH[(trial * 7 + i * 3) % 6], b: C.TEETH[(trial * 5 + i * 11) % 6], idler: (trial + i) % 3 === 0 });
    const gs = C.layout(stages).gears, r = C.evaluate(stages);
    speed = Math.max(speed, Math.abs(gs[gs.length - 1].k * C.INPUT - r.dir * r.rpm));
    for (let i = 0; i + 1 < gs.length; i++) {
      const A = gs[i], B = gs[i + 1];
      if (Math.abs(Math.hypot(B.x - A.x, B.y - A.y) - (A.n + B.n) / 2) > 1e-9) continue;   // same shaft
      const phi = Math.atan2(B.y - A.y, B.x - A.x);
      for (const th of [0, 0.37, 1.9, 4.2, 11.1]) {
        const dA = wrap(phi - (A.k * th + A.p), 2 * Math.PI / A.n);
        const dB = wrap(phi + Math.PI - (B.k * th + B.p + Math.PI / B.n), 2 * Math.PI / B.n);
        worst = Math.max(worst, Math.abs(wrap(A.n / 2 * dA + B.n / 2 * dB, Math.PI))); contacts++;
      }
    }
  }
  check(worst < 1e-9, `${contacts} tooth contacts: every tooth sits in a gap (worst ${worst.toExponential(0)} module)`);
  check(speed < 1e-9, 'the drawn output shaft turns at exactly the computed speed');
}

// ---------------------------------------------------------------- views
console.log('Three Views');
{
  const C = G('views');
  // Independent of view(): find every crease from the exposed cube faces,
  // project the ones that lie parallel to the sheet, and compare.
  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const creases = (o) => {
    const out = new Set();
    for (let y = 0; y < o.Y; y++) for (let x = 0; x < o.X; x++) for (let z = 0; z < o.h[y][x]; z++) for (const n of DIRS) {
      if (C.occ(o, x + n[0], y + n[1], z + n[2])) continue;
      const axes = [0, 1, 2].filter((a) => n[a] === 0), base = [x, y, z];
      if (n[0] + n[1] + n[2] > 0) base[n.findIndex((v) => v !== 0)] += 1;
      for (const a of axes) for (const side of [0, 1]) {
        const e = [0, 0, 0]; e[a] = side ? 1 : -1;
        const nb = [x + e[0], y + e[1], z + e[2]];
        if (C.occ(o, ...nb) && !C.occ(o, nb[0] + n[0], nb[1] + n[1], nb[2] + n[2])) continue;
        const b = axes.find((q) => q !== a), p0 = base.slice(); if (side) p0[a] += 1;
        const p1 = p0.slice(); p1[b] += 1;
        out.add(JSON.stringify([p0, p1]));
      }
    }
    return [...out].map((s) => JSON.parse(s));
  };
  const PROJ = { front: (o, p) => [p[0], p[2]], top: (o, p) => [p[0], p[1]], right: (o, p) => [p[1], p[2]], left: (o, p) => [o.Y - p[1], p[2]] };
  const SIGHT = { front: 1, top: 2, right: 0, left: 0 };
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let bad = 0, n = 0, hiddenTop = 0;
  for (let i = 0; i < 1500; i++) {
    const o = C.block(rnd, C.TIERS[i % 3]), cr = creases(o);
    for (const name of C.NAMES) {
      const want = new Set(cr.filter(([a, b]) => a[SIGHT[name]] === b[SIGHT[name]])
        .map(([a, b]) => JSON.stringify([PROJ[name](o, a), PROJ[name](o, b)].sort((m, q) => m[0] - q[0] || m[1] - q[1]))));
      const dr = C.view(o, name), got = new Set(dr.segs.map((s) => JSON.stringify([[s.x0, s.y0], [s.x1, s.y1]])));
      if (want.size !== got.size || [...want].some((k) => !got.has(k))) bad++;
      if (name === 'top' && dr.segs.some((s) => s.k === 2)) hiddenTop++;
      n++;
    }
  }
  check(bad === 0, `${n} drawings: every line is a projected edge of the block and every such edge is drawn`);
  check(hiddenTop === 0, 'no top view of a stack of columns has a hidden line');
  let qbad = 0;
  for (let i = 0; i < 400; i++) {
    const q = C.question(rnd, i % C.ROUND, null);
    const keys = new Set(q.options.map((op) => C.key(op.d)));
    if (keys.size !== 4 || C.key(q.options[q.answer].d) !== C.key(C.view(q.o, q.ask)) || !C.readable(q.o)) qbad++;
  }
  check(qbad === 0, '400 questions: four different drawings, exactly one of them the view asked for, every block fully visible');
}

// ---------------------------------------------------------------- logic
console.log('Light the LED');
{
  const C = G('logic');
  for (const L of C.LEVELS) {
    const ways = C.solutions(L).length, of = Math.pow(C.CHOICES.length, C.slots(L).length);
    // solvable, and a random filling rarely is: one in five at best for a single slot
    check(ways >= 1 && ways <= Math.max(1, of / 20), `level ${L.id}: ${ways} of ${of} fillings solve it`);
    check(!C.check(L, {}).solved, `level ${L.id}: an empty circuit does not count as solved`);
  }
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
