/* Read the Caliper: ten vernier readings against the clock.
 *
 * Positions are kept as exact fractions of a millimetre: vernier line j sits at
 * (whole*n + k + j*(n-1)) / n mm. A floating-point drift of a few hundredths of
 * a pixel is enough to make the wrong line look aligned, so nothing here is
 * approximated until it is drawn.
 */
(function (root) {
	'use strict';

	var Core = (function () {
		var MODES = {
			'0.1': { key: '0.1', n: 10, digits: 1 },     // 10 divisions over 9 mm
			'0.05': { key: '0.05', n: 20, digits: 2 }    // 20 divisions over 19 mm
		};
		var MAX = 120;

		function value(r, m) { return r.whole + r.k / m.n; }
		function newReading(rand, m) {
			return { whole: Math.floor(rand() * (MAX + 1)), k: Math.floor(rand() * m.n) };
		}
		/* exact position of vernier line j, as numerator over n */
		function vernierNum(r, m, j) { return r.whole * m.n + r.k + j * (m.n - 1); }
		function vernierPos(r, m, j) { return vernierNum(r, m, j) / m.n; }
		/* the vernier lines that coincide with a main-scale line */
		function aligned(r, m) {
			var out = [];
			for (var j = 0; j <= m.n; j++) if (vernierNum(r, m, j) % m.n === 0) out.push(j);
			return out;
		}
		function check(r, m, answer) { return Math.abs(answer - value(r, m)) < 1e-6; }

		return { MODES: MODES, MAX: MAX, value: value, newReading: newReading,
			vernierPos: vernierPos, vernierNum: vernierNum, aligned: aligned, check: check };
	})();

	if (typeof document === 'undefined') { module.exports = Core; return; }
	var G = root.JKGames;
	var section = document.getElementById('caliper');
	if (!G || !section) return;

	var S = {
		en: { start: 'Start', check: 'Check', next: 'Next', finish: 'See the result', again: 'Play again',
			progress: 'Reading {i} of 10 · {c} correct · {s} s',
			example: 'Worked example: {m} mm on the main scale + line {k} × {lc} mm = {r} mm. Press Start for ten readings.',
			correct: 'Correct: {r} mm.', wrong: 'Not quite: it reads {r} mm ({m} mm on the main scale + line {k} × {lc} mm).',
			invalid: 'Type a number in millimetres, for example {ex}.',
			done: '{c} / 10 in {s} s', best: 'Best: {c} / 10 in {s} s', newBest: 'New best!',
			doneStatus: 'Round over: {c} out of 10 in {s} seconds.',
			main: '{m} mm', line: 'line {k} → {f} mm', aria: 'Vernier caliper showing a measurement to read.' },
		fr: { start: 'Démarrer', check: 'Valider', next: 'Suivant', finish: 'Voir le résultat', again: 'Rejouer',
			progress: 'Lecture {i} sur 10 · {c} justes · {s} s',
			example: 'Exemple : {m} mm sur la règle + trait {k} × {lc} mm = {r} mm. Appuyez sur Démarrer pour dix lectures.',
			correct: 'Exact : {r} mm.', wrong: 'Pas tout à fait : la lecture est {r} mm ({m} mm sur la règle + trait {k} × {lc} mm).',
			invalid: 'Saisissez un nombre en millimètres, par exemple {ex}.',
			done: '{c} / 10 en {s} s', best: 'Record : {c} / 10 en {s} s', newBest: 'Nouveau record !',
			doneStatus: 'Manche terminée : {c} sur 10 en {s} secondes.',
			main: '{m} mm', line: 'trait {k} → {f} mm', aria: 'Pied à coulisse affichant une mesure à lire.' },
		zh: { start: '开始', check: '确定', next: '下一题', finish: '查看结果', again: '再玩一次',
			progress: '第 {i}/10 题 · 答对 {c} 题 · {s} 秒',
			example: '示例：主尺 {m} mm + 第 {k} 条游标刻线 × {lc} mm = {r} mm。点“开始”进行十次读数。',
			correct: '正确：{r} mm。', wrong: '不对：读数是 {r} mm（主尺 {m} mm + 第 {k} 条游标刻线 × {lc} mm）。',
			invalid: '请输入以毫米为单位的数字，例如 {ex}。',
			done: '{c}/10，用时 {s} 秒', best: '最高：{c}/10，{s} 秒', newBest: '新纪录！',
			doneStatus: '本轮结束：10 题答对 {c} 题，用时 {s} 秒。',
			main: '{m} mm', line: '第 {k} 条 → {f} mm', aria: '游标卡尺显示一个待读取的测量值。' }
	};
	function tr(k, v) { return G.t(S, k, v); }

	var EXAMPLES = { '0.1': { whole: 23, k: 4 }, '0.05': { whole: 41, k: 7 } };
	var ZOOMS = [1, 1.5, 2, 3, 4];

	var stageEl = section.querySelector('.game__stage');
	var canvas = section.querySelector('canvas');
	var form = section.querySelector('form');
	var field = form.querySelector('input');
	var goBtn = form.querySelector('[type="submit"]');
	var startBtn = section.querySelector('[data-act="start"]');
	var metaEl = section.querySelector('.game__meta');
	var statusEl = section.querySelector('.game__status');
	var zoomOut = section.querySelector('[data-zoom="-"]'), zoomIn = section.querySelector('[data-zoom="+"]');
	var zoomLabel = section.querySelector('.caliper__zoom');

	var zi = 0;
	var stage = new G.Stage(canvas, { aspect: function (w) { return w < 560 ? 2.0 : 3.0; }, minH: 170, maxH: 280,
		zoom: function () { return ZOOMS[zi]; } });
	var pal = G.palette(section);

	var modeKey = G.store.get('caliper:mode', '0.1');
	if (!Core.MODES[modeKey]) modeKey = '0.1';
	var M = Core.MODES[modeKey];
	var phase = 'intro', reading = EXAMPLES[modeKey], reveal = true;
	var index = 0, correct = 0, t0 = 0, elapsed = 0, timer = 0, lastBest = false;

	function fmt(r) { return G.num(Core.value(r, M), M.digits); }
	function lcText() { return G.num(1 / M.n, M.digits); }
	function bestOf(k) { return G.store.get('caliper:best:' + k, null); }

	function setMode(k) {
		modeKey = k; M = Core.MODES[k]; G.store.set('caliper:mode', k);
		section.querySelectorAll('[data-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === k)); });
		intro();
	}

	function intro() {
		stopTimer();
		phase = 'intro'; reading = EXAMPLES[modeKey]; reveal = true;
		field.value = ''; field.disabled = true; goBtn.disabled = true; goBtn.textContent = tr('check');
		startBtn.hidden = false; startBtn.textContent = tr('start');
		statusEl.textContent = tr('example', { m: reading.whole, k: reading.k, lc: lcText(), r: fmt(reading) });
		showBest();
		draw(); centre();
	}
	function showBest() {
		var b = bestOf(modeKey);
		metaEl.textContent = b ? tr('best', { c: b.c, s: b.s }) : '';
	}

	function startRound() {
		index = 0; correct = 0; t0 = performance.now(); elapsed = 0; lastBest = false;
		startBtn.hidden = true; field.disabled = false;
		timer = setInterval(tick, 500);
		ask();
	}
	function tick() { elapsed = Math.round((performance.now() - t0) / 1000); progress(); }
	function stopTimer() { if (timer) { clearInterval(timer); timer = 0; } }
	function progress() {
		// while a reading's answer is on show it is still that reading, not the next one
		var i = phase === 'shown' ? index : index + 1;
		metaEl.textContent = tr('progress', { i: Math.min(Math.max(i, 1), 10), c: correct, s: elapsed });
	}

	function ask() {
		phase = 'ask'; reveal = false;
		var prev = reading;
		do { reading = Core.newReading(Math.random, M); } while (prev && reading.whole === prev.whole && reading.k === prev.k);
		field.readOnly = false; field.value = ''; goBtn.disabled = false; goBtn.textContent = tr('check');
		statusEl.textContent = '';
		progress(); draw(); centre();
		field.focus({ preventScroll: true });
	}

	function submit() {
		if (phase === 'shown') { if (index >= 10) finish(); else ask(); return; }
		if (phase !== 'ask') return;
		var v = G.parseNum(field.value);
		if (isNaN(v)) { statusEl.textContent = tr('invalid', { ex: G.num(12.4, 1) }); field.focus(); return; }
		var ok = Core.check(reading, M, v);
		if (ok) correct++;
		index++;
		phase = 'shown'; reveal = true; field.readOnly = true;
		statusEl.textContent = ok ? tr('correct', { r: fmt(reading) })
			: tr('wrong', { r: fmt(reading), m: reading.whole, k: reading.k, lc: lcText() });
		section.classList.toggle('is-wrong', !ok); section.classList.toggle('is-right', ok);
		goBtn.textContent = index >= 10 ? tr('finish') : tr('next');
		tick(); draw();
	}

	function finish() {
		stopTimer();
		elapsed = Math.round((performance.now() - t0) / 1000);
		phase = 'done'; reveal = false;
		section.classList.remove('is-wrong', 'is-right');
		var b = bestOf(modeKey);
		lastBest = !b || correct > b.c || (correct === b.c && elapsed < b.s);
		if (lastBest) G.store.set('caliper:best:' + modeKey, { c: correct, s: elapsed });
		field.disabled = true; goBtn.disabled = true;
		startBtn.hidden = false; startBtn.textContent = tr('again');
		statusEl.textContent = tr('doneStatus', { c: correct, s: elapsed });
		showBest(); draw();
		startBtn.focus({ preventScroll: true });
	}

	// ---------------------------------------------------------------- drawing
	function vlen(j) {               // vernier tick length: labelled, half-millimetre, plain
		var h = stage.h, major = M.n === 10 ? j % 5 === 0 : j % 4 === 0;
		return major ? h * 0.13 : (M.n === 20 && j % 2 === 0) ? h * 0.1 : h * 0.075;
	}
	function geometry() {
		var startMM = Core.value(reading, M) - 6.5;
		var widthMM = (M.n - 1) + 10.5;
		return { startMM: startMM, widthMM: widthMM, ppm: stage.w / widthMM };
	}
	function centre() {         // keep the vernier in view when zoomed
		var g = geometry();
		var mid = (Core.value(reading, M) + (M.n - 1) / 2 - g.startMM) * g.ppm;
		stageEl.scrollLeft = Math.max(0, mid - stageEl.clientWidth / 2);
	}

	function draw() {
		var ctx = stage.ctx, w = stage.w, h = stage.h, g = geometry();
		function X(mm) { return (mm - g.startMM) * g.ppm; }
		var y0 = h * 0.17, y1 = h * 0.52, y2 = h * 0.84;
		var fs = Math.max(11, Math.min(15, h * 0.07));

		ctx.fillStyle = pal.panel; ctx.fillRect(0, 0, w, h);

		// main beam
		var gb = ctx.createLinearGradient(0, y0, 0, y1);
		gb.addColorStop(0, pal.metal1); gb.addColorStop(1, pal.metal2);
		ctx.fillStyle = gb; ctx.fillRect(0, y0, w, y1 - y0);
		ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, y0, w, 1);

		ctx.fillStyle = pal.metalInk; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
		ctx.font = G.font(fs, 600);
		for (var i = Math.max(0, Math.floor(g.startMM)); i <= Math.ceil(g.startMM + g.widthMM); i++) {
			var len = i % 10 === 0 ? h * 0.2 : i % 5 === 0 ? h * 0.13 : h * 0.075;
			var x = X(i);
			ctx.fillRect(x - 0.5, y1 - len, 1, len);
			if (i % 10 === 0) ctx.fillText(String(i), x, y1 - len - 2);
		}

		// vernier plate
		var v0 = Core.value(reading, M);
		var px0 = X(v0 - 2.5), px1 = X(v0 + (M.n - 1) + 2.5);
		var gs = ctx.createLinearGradient(0, y1, 0, y2);
		gs.addColorStop(0, pal.slider1); gs.addColorStop(1, pal.slider2);
		ctx.fillStyle = gs; G.roundRect(ctx, px0, y1, px1 - px0, y2 - y1, 4); ctx.fill();
		ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(px0, y1, px1 - px0, 1);

		ctx.fillStyle = pal.metalInk; ctx.textBaseline = 'top'; ctx.font = G.font(fs * 0.92, 600);
		for (var j = 0; j <= M.n; j++) {
			var major = M.n === 10 ? j % 5 === 0 : j % 4 === 0;
			var vl = vlen(j);
			var vx = X(Core.vernierPos(reading, M, j));
			ctx.fillRect(vx - 0.5, y1, 1, vl);
			if (major) ctx.fillText(String(M.n === 10 ? j : j / 2), vx, y1 + vl + 2);
		}
		ctx.font = G.font(fs * 0.78); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
		ctx.globalAlpha = 0.75;
		ctx.fillText(G.num(1 / M.n, M.digits) + ' mm', px1 - 8, y2 - 5);
		ctx.globalAlpha = 1;
		// the locking screw
		var sx = px1 - fs * 1.2, sy = y2 - fs * 2.2, sr = Math.max(4, fs * 0.45);
		var gsc = ctx.createRadialGradient(sx - sr * 0.3, sy - sr * 0.3, 1, sx, sy, sr);
		gsc.addColorStop(0, pal.metal1); gsc.addColorStop(1, pal.metal2);
		ctx.fillStyle = gsc; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 6.283); ctx.fill();
		ctx.strokeStyle = pal.metalInk; ctx.globalAlpha = 0.6; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
		ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(sx - sr * 0.6, sy + sr * 0.35); ctx.lineTo(sx + sr * 0.6, sy - sr * 0.35); ctx.stroke();

		if (reveal) explain(ctx, X, y0, y1, y2, fs, w);
		if (phase === 'done') {
			var b = bestOf(modeKey);
			G.banner(ctx, pal, Math.min(w, stageEl.clientWidth), h, [tr('done', { c: correct, s: elapsed }),
				lastBest ? tr('newBest') : (b ? tr('best', { c: b.c, s: b.s }) : '')]);
		}
		canvas.setAttribute('aria-label', tr('aria'));
	}

	/* The worked answer: the last main-scale line before zero, and the vernier line that lines up. */
	function explain(ctx, X, y0, y1, y2, fs, w) {
		var k = reading.k;
		var xm = X(reading.whole), x0 = X(Core.vernierPos(reading, M, 0)), xa = X(Core.vernierPos(reading, M, k));
		var h = stage.h;
		var mainLen = reading.whole % 10 === 0 ? h * 0.2 : reading.whole % 5 === 0 ? h * 0.13 : h * 0.075;
		// Each highlight covers its own tick and stops there, so no scale label is hidden.
		ctx.fillStyle = pal.accent;
		if (reading.whole % 10 !== 0) { ctx.globalAlpha = 0.55; ctx.fillRect(xm - 0.5, y0, 1, y1 - mainLen - y0); ctx.globalAlpha = 1; }
		ctx.fillRect(xm - 1.5, y1 - mainLen, 3, mainLen);
		ctx.fillRect(x0 - 1.5, y1, 3, vlen(0));
		ctx.fillStyle = pal.good;
		ctx.fillRect(xa - 1.5, y1 - (y1 - y0) * 0.45, 3, (y1 - y0) * 0.45 + vlen(k));
		tag(ctx, tr('main', { m: reading.whole }), xm, y0 - 3, 'bottom', pal.accent, fs, w);
		tag(ctx, tr('line', { k: k, f: G.num(k / M.n, M.digits) }), xa, y2 + 3, 'top', pal.good, fs, w);
	}
	function tag(ctx, text, x, y, base, colour, fs, w) {
		ctx.font = G.font(fs, 700);
		var tw = ctx.measureText(text).width;
		var cx = Math.max(tw / 2 + 4, Math.min(w - tw / 2 - 4, x));
		ctx.fillStyle = colour; ctx.textAlign = 'center'; ctx.textBaseline = base;
		ctx.fillText(text, cx, y);
	}

	// ---------------------------------------------------------------- wiring
	form.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
	startBtn.addEventListener('click', startRound);
	section.querySelectorAll('[data-mode]').forEach(function (b) {
		b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); });
	});
	function setZoom(d) {
		zi = Math.max(0, Math.min(ZOOMS.length - 1, zi + d));
		zoomLabel.textContent = G.num(ZOOMS[zi], ZOOMS[zi] % 1 ? 1 : 0) + '×';
		zoomOut.disabled = zi === 0; zoomIn.disabled = zi === ZOOMS.length - 1;
		stage.fit(); draw(); centre();
	}
	zoomOut.addEventListener('click', function () { setZoom(-1); });
	zoomIn.addEventListener('click', function () { setZoom(1); });
	stage.onResize = function () { draw(); };
	G.onScheme(function () { pal = G.palette(section); draw(); });

	setMode(modeKey);
	setZoom(0);
	G.games.caliper = { Core: Core, get state() { return { phase: phase, reading: reading, mode: modeKey, index: index, correct: correct }; } };
})(typeof window !== 'undefined' ? window : this);
