/* Tune the Loop: set the three gains of a PID controller against four plants.
 *
 * Every level is a lesson in one term of the controller: the first cannot reach
 * its target without integral action, the second cannot be damped without
 * derivative action, the third rejects a load only with integral action, and
 * the fourth punishes aggressive gains because its sensor is late. Core is
 * DOM-free so the levels can be checked under Node: each must be passable, and
 * each must fail without the term it is teaching.
 */
(function (root) {
	'use strict';

	var Core = (function () {
		var DT = 0.002, TF = 0.01, R = 1;

		var LEVELS = [
			{ id: 1, plant: 'first', K: 1, tau: 0.5, umax: 5, delay: 0, dist: null, T: 4,
				os: 10, ts: 1.5, ess: 1, kp: [0, 10, 0.1], ki: [0, 20, 0.1], kd: [0, 1, 0.01], init: [1, 0, 0] },
			{ id: 2, plant: 'second', K: 1, tau: 0.3, umax: 6, delay: 0, dist: null, T: 4,
				os: 5, ts: 1.0, ess: 1, kp: [0, 40, 0.1], ki: [0, 10, 0.1], kd: [0, 5, 0.01], init: [1, 0, 0] },
			{ id: 3, plant: 'second', K: 1, tau: 0.3, umax: 4, delay: 0, dist: { t: 2.5, d: -1 }, T: 5,
				os: 10, ts: 1.5, ess: 2, kp: [0, 40, 0.1], ki: [0, 20, 0.1], kd: [0, 5, 0.01], init: [1, 0, 0] },
			{ id: 4, plant: 'second', K: 1, tau: 0.6, umax: 3, delay: 0.12, dist: null, T: 5,
				os: 15, ts: 2.5, ess: 2, kp: [0, 20, 0.1], ki: [0, 10, 0.1], kd: [0, 5, 0.01], init: [1, 0, 0] }
		];

		/* Fixed-step simulation, derivative on the measurement (no kick on the
		 * step), first-order filter on the derivative, conditional integration so
		 * the integrator does not wind up against the actuator limit. */
		function simulate(L, kp, ki, kd) {
			var N = Math.round(L.T / DT) + 1;
			var t = new Float32Array(N), y = new Float32Array(N), u = new Float32Array(N);
			var x = 0, v = 0, I = 0, dF = 0, prev = 0;
			var lag = Math.round(L.delay / DT), buf = new Float32Array(lag + 1), bi = 0;
			var unstable = false, n = N;
			for (var i = 0; i < N; i++) {
				var ti = i * DT;
				var ym = lag ? buf[bi] : x;
				var e = R - ym;
				dF += (DT / (TF + DT)) * ((ym - prev) / DT - dF);
				prev = ym;
				var raw = kp * e + I - kd * dF;
				var uc = Math.max(-L.umax, Math.min(L.umax, raw));
				if (!((raw > L.umax && e > 0) || (raw < -L.umax && e < 0))) I += ki * e * DT;
				var d = L.dist && ti >= L.dist.t ? L.dist.d : 0;
				t[i] = ti; y[i] = x; u[i] = uc;
				if (L.plant === 'first') x += DT * (-x + L.K * (uc + d)) / L.tau;
				else { v += DT * (-v + L.K * (uc + d)) / L.tau; x += v * DT; }
				if (lag) { buf[bi] = x; bi = (bi + 1) % (lag + 1); }
				if (!isFinite(x) || Math.abs(x) > 20) { unstable = true; n = i + 1; break; }
			}
			var res = { t: t, y: y, u: u, n: n, unstable: unstable };
			res.m = metrics(L, res);
			return res;
		}

		function mean(a, i0, i1) { var s = 0; for (var i = i0; i < i1; i++) s += a[i]; return s / Math.max(1, i1 - i0); }

		function metrics(L, s) {
			var m = { os: null, rise: null, settle: null, ess: null, pass: false, stars: 0, unstable: s.unstable };
			if (s.unstable) return m;
			var tW = L.dist ? L.dist.t : L.T;
			var iW = Math.min(s.n, Math.round(tW / DT));
			var peak = -Infinity, t10 = null, t90 = null, last = -1;
			for (var i = 0; i < iW; i++) {
				var yi = s.y[i];
				if (yi > peak) peak = yi;
				if (t10 === null && yi >= 0.1 * R) t10 = s.t[i];
				if (t90 === null && yi >= 0.9 * R) t90 = s.t[i];
				if (Math.abs(yi - R) > 0.02 * R) last = i;
			}
			m.os = Math.max(0, (peak - R) / R * 100);
			m.rise = t10 !== null && t90 !== null ? t90 - t10 : null;
			m.settle = last < iW - 1 ? s.t[last + 1] : null;
			var tail = Math.round(0.3 / DT);
			m.ess = Math.abs(R - mean(s.y, Math.max(0, iW - tail), iW)) / R * 100;
			if (L.dist) {
				var tail2 = Math.round(0.4 / DT);
				m.essFinal = Math.abs(R - mean(s.y, s.n - tail2, s.n)) / R * 100;
				m.ess = Math.max(m.ess, m.essFinal);
			}
			m.pass = m.os <= L.os && m.settle !== null && m.settle <= L.ts && m.ess <= L.ess;
			m.stars = m.pass ? 1 + (m.settle <= 0.7 * L.ts ? 1 : 0) + (m.settle <= 0.5 * L.ts && m.os <= 0.5 * L.os ? 1 : 0) : 0;
			return m;
		}

		return { DT: DT, R: R, LEVELS: LEVELS, simulate: simulate };
	})();

	if (typeof document === 'undefined') { module.exports = Core; return; }
	var G = root.JKGames;
	var section = document.getElementById('pid');
	if (!G || !section) return;

	var S = {
		en: { names: ['Fan speed', 'Motor position', 'Position under load', 'Drone altitude, late sensor'],
			hints: ['A fan’s speed follows the motor command after a lag. Proportional gain alone always stops short of the target: the controller needs a term that keeps pushing while any error is left.',
				'A motor’s position integrates its speed, so proportional gain alone gets there, but slowly or ringing. Fast and calm together needs damping, which is what the derivative term adds.',
				'Same motor, but at t = 2.5 s a load pushes back on it. Proportional and derivative action alone let the position sag and stay off target; only integral action pulls it back.',
				'The altitude sensor reports 120 ms late, so the controller always reacts to where the drone was. Gains that would settle with a perfect sensor ring here and never settle: ease off the proportional gain and lean on the derivative.'],
			level: 'Level {n}', measure: 'Measure', value: 'Value', target: 'Target',
			os: 'Overshoot', settle: 'Settling time (2 %)', ess: 'Steady-state error', rise: 'Rise time', never: 'never',
			unstable: 'Unstable: the output runs away. Lower the gains.', pass: 'Pass', fail: 'Not yet', stars: '{n} of 3 stars',
			status: 'Level {n}: {res}.', output: 'output', command: 'command', time: 'time (s)', load: 'load', limit: 'limit',
			aria: 'Step response of the closed loop, level {n}: {res}.' },
		fr: { names: ['Vitesse d’un ventilateur', 'Position d’un moteur', 'Position sous charge', 'Altitude d’un drone, capteur en retard'],
			hints: ['La vitesse d’un ventilateur suit la commande avec un retard. Le gain proportionnel seul s’arrête toujours avant la consigne : il faut un terme qui continue de pousser tant qu’il reste une erreur.',
				'La position d’un moteur intègre sa vitesse : le gain proportionnel seul finit par y arriver, mais lentement ou en oscillant. Être rapide et calme demande de l’amortissement, et c’est ce qu’apporte le terme dérivé.',
				'Même moteur, mais à t = 2,5 s une charge s’oppose à lui. Le proportionnel et le dérivé seuls laissent la position s’affaisser et rester décalée ; seule l’action intégrale la ramène.',
				'Le capteur d’altitude répond avec 120 ms de retard : le correcteur réagit toujours à l’endroit où le drone était. Des gains qui se stabiliseraient avec un capteur parfait oscillent ici sans jamais se stabiliser : réduisez le proportionnel et misez sur le dérivé.'],
			level: 'Niveau {n}', measure: 'Mesure', value: 'Valeur', target: 'Objectif',
			os: 'Dépassement', settle: 'Temps de réponse à 2 %', ess: 'Erreur statique', rise: 'Temps de montée', never: 'jamais',
			unstable: 'Instable : la sortie diverge. Baissez les gains.', pass: 'Réussi', fail: 'Pas encore', stars: '{n} étoile(s) sur 3',
			status: 'Niveau {n} : {res}.', output: 'sortie', command: 'commande', time: 'temps (s)', load: 'charge', limit: 'limite',
			aria: 'Réponse indicielle de la boucle fermée, niveau {n} : {res}.' },
		zh: { names: ['风扇转速', '电机位置', '负载下的位置', '无人机高度（传感器延迟）'],
			hints: ['风扇转速对电机指令的响应有滞后。只用比例增益总会停在目标值之前：需要一个只要还有误差就持续推动的项。',
				'电机位置是速度的积分，所以只用比例增益也能到达目标，但要么慢、要么振荡。想要既快又稳就需要阻尼，而阻尼正来自微分项。',
				'同一台电机，但在 t = 2.5 秒时负载开始反向作用。只靠比例和微分，位置会下沉并一直偏离目标；只有积分作用能把它拉回来。',
				'高度传感器有 120 毫秒延迟，控制器总是在对无人机过去的位置做出反应。在理想传感器上能稳定的增益，在这里会一直振荡、无法稳定：降低比例增益，多依靠微分项。'],
			level: '第 {n} 关', measure: '指标', value: '数值', target: '目标',
			os: '超调量', settle: '调节时间（2%）', ess: '稳态误差', rise: '上升时间', never: '未稳定',
			unstable: '不稳定：输出发散，请降低增益。', pass: '通过', fail: '未通过', stars: '{n}/3 颗星',
			status: '第 {n} 关：{res}。', output: '输出', command: '控制量', time: '时间（秒）', load: '负载', limit: '上限',
			aria: '第 {n} 关闭环阶跃响应：{res}。' }
	};
	function tr(k, v) { return G.t(S, k, v); }
	function list(k, i) { return (S[G.lang] || S.en)[k][i]; }

	var canvas = section.querySelector('canvas');
	var statusEl = section.querySelector('.game__status');
	var nameEl = section.querySelector('.pid__name'), hintEl = section.querySelector('.pid__hint');
	var tbody = section.querySelector('.pid__metrics tbody'), thead = section.querySelector('.pid__metrics thead');
	var sliders = {}, outputs = {};
	section.querySelectorAll('[data-gain]').forEach(function (inp) {
		var k = inp.getAttribute('data-gain');
		sliders[k] = inp; outputs[k] = inp.parentElement.querySelector('output');
	});
	var stage = new G.Stage(canvas, { aspect: function (w) { return w < 560 ? 1.2 : 2.1; }, maxH: 420 });
	var pal = G.palette(section);

	var stars = G.store.get('pid:stars', [0, 0, 0, 0]);
	var li = 0, L = Core.LEVELS[0], sim = null, announce = 0, lastRes = '';

	function setLevel(i) {
		li = i; L = Core.LEVELS[i];
		section.querySelectorAll('[data-level]').forEach(function (b, j) { b.setAttribute('aria-pressed', String(j === i)); });
		nameEl.textContent = tr('level', { n: L.id }) + ' · ' + list('names', i) + '.';
		hintEl.textContent = list('hints', i);
		['kp', 'ki', 'kd'].forEach(function (k) {
			var r = L[k]; sliders[k].min = r[0]; sliders[k].max = r[1]; sliders[k].step = r[2];
		});
		var saved = G.store.get('pid:gains:' + L.id, null);
		setGains(saved || L.init);
	}
	function setGains(g) {
		sliders.kp.value = g[0]; sliders.ki.value = g[1]; sliders.kd.value = g[2];
		run(true);
	}
	function gains() { return [parseFloat(sliders.kp.value), parseFloat(sliders.ki.value), parseFloat(sliders.kd.value)]; }

	function run(quiet) {
		var g = gains();
		outputs.kp.textContent = G.num(g[0], 1); outputs.ki.textContent = G.num(g[1], 1); outputs.kd.textContent = G.num(g[2], 2);
		sim = Core.simulate(L, g[0], g[1], g[2]);
		var m = sim.m;
		if (m.stars > stars[li]) { stars[li] = m.stars; G.store.set('pid:stars', stars); }
		G.store.set('pid:gains:' + L.id, g);
		paintStars(); table(m); draw();
		var res = m.unstable ? tr('unstable') : (m.pass ? tr('pass') + ', ' + tr('stars', { n: m.stars }) : tr('fail'));
		canvas.setAttribute('aria-label', tr('aria', { n: L.id, res: res }));
		section.classList.toggle('is-right', m.pass); section.classList.toggle('is-wrong', !m.pass && !quiet);
		// announce the verdict once the slider rests, not on every step of a drag
		clearTimeout(announce);
		if (res !== lastRes && !quiet) announce = setTimeout(function () { statusEl.textContent = tr('status', { n: L.id, res: res }); }, 700);
		lastRes = res;
	}

	function starSpans(el, n) {
		el.textContent = '';
		var on = document.createElement('span'), off = document.createElement('span');
		on.className = 'on'; on.textContent = '★'.repeat(n);
		off.className = 'off'; off.textContent = '☆'.repeat(3 - n);
		el.appendChild(on); el.appendChild(off);
	}
	function paintStars() {
		section.querySelectorAll('[data-level]').forEach(function (b, j) {
			starSpans(b.querySelector('.pid__stars'), stars[j]);
			// the stars are hidden from screen readers, so the count goes in the name
			b.setAttribute('aria-label', tr('level', { n: j + 1 }) + (G.lang === 'zh' ? '，' : ', ') + tr('stars', { n: stars[j] }));
		});
	}

	function table(m) {
		thead.innerHTML = '';
		var hr = document.createElement('tr');
		[tr('measure'), tr('value'), tr('target'), ''].forEach(function (h) { var th = document.createElement('th'); th.textContent = h; hr.appendChild(th); });
		thead.appendChild(hr);
		var rows = [
			[tr('os'), m.os === null ? '—' : G.num(m.os, 1) + ' %', '≤ ' + G.num(L.os, 0) + ' %', m.os !== null && m.os <= L.os],
			[tr('settle'), m.settle === null ? tr('never') : G.num(m.settle, 2) + ' s', '≤ ' + G.num(L.ts, 1) + ' s', m.settle !== null && m.settle <= L.ts],
			[tr('ess'), m.ess === null ? '—' : G.num(m.ess, 1) + ' %', '≤ ' + G.num(L.ess, 0) + ' %', m.ess !== null && m.ess <= L.ess],
			[tr('rise'), m.rise === null ? '—' : G.num(m.rise, 2) + ' s', '', null]
		];
		tbody.innerHTML = '';
		rows.forEach(function (r) {
			var tr_ = document.createElement('tr');
			r.forEach(function (c, i) {
				var td = document.createElement('td');
				if (i === 3) {
					td.textContent = c === null ? '' : c ? '✓' : '✗';
					if (c !== null) td.className = c ? 'is-ok' : 'is-bad';
				} else td.textContent = c;
				tr_.appendChild(td);
			});
			tbody.appendChild(tr_);
		});
		var res = document.createElement('tr'); res.className = 'pid__result';
		var td = document.createElement('td'); td.colSpan = 4;
		td.className = m.pass ? 'is-ok' : 'is-bad';
		if (m.pass) {
			td.textContent = tr('pass') + ' · ';
			var st = document.createElement('span'); st.className = 'pid__stars'; st.setAttribute('aria-hidden', 'true');
			starSpans(st, m.stars); td.appendChild(st);
			var sr = document.createElement('span'); sr.className = 'visually-hidden'; sr.textContent = tr('stars', { n: m.stars });
			td.appendChild(sr);
		} else td.textContent = m.unstable ? tr('unstable') : tr('fail');
		res.appendChild(td); tbody.appendChild(res);
	}

	function draw() {
		var ctx = stage.ctx, w = stage.w, h = stage.h;
		var fs = Math.max(11, Math.min(13, w / 60));
		var ml = fs * 3.4, mr = 12, mt = 12, mb = fs * 2.6;
		var gap = fs * 1.4;
		var ph = h - mt - mb - gap;
		var h1 = ph * 0.7, h2 = ph * 0.3;
		var top1 = mt, top2 = mt + h1 + gap;
		var pw = w - ml - mr;
		var Y1 = [-0.2, 1.8], Y2 = [-L.umax * 1.15, L.umax * 1.15];
		function X(t) { return ml + t / L.T * pw; }
		function Ya(v) { return top1 + (1 - (v - Y1[0]) / (Y1[1] - Y1[0])) * h1; }
		function Yb(v) { return top2 + (1 - (v - Y2[0]) / (Y2[1] - Y2[0])) * h2; }

		ctx.fillStyle = pal.panel; ctx.fillRect(0, 0, w, h);
		ctx.font = G.font(fs); ctx.textBaseline = 'middle';

		// grid and time axis
		ctx.strokeStyle = pal.grid; ctx.lineWidth = 1;
		for (var tt = 0; tt <= L.T + 1e-9; tt += 0.5) {
			ctx.beginPath(); ctx.moveTo(Math.round(X(tt)) + 0.5, top1); ctx.lineTo(Math.round(X(tt)) + 0.5, top2 + h2); ctx.stroke();
			if (Math.abs(tt - Math.round(tt)) < 1e-9) {
				ctx.fillStyle = pal.muted; ctx.textAlign = 'center';
				ctx.fillText(G.num(tt, 0), X(tt), top2 + h2 + fs * 0.9);
			}
		}
		ctx.textAlign = 'right'; ctx.fillStyle = pal.muted;
		ctx.fillText(tr('time'), w - mr, top2 + h2 + fs * 1.9);
		[0, 0.5, 1, 1.5].forEach(function (v) {
			ctx.strokeStyle = pal.grid; ctx.beginPath(); ctx.moveTo(ml, Math.round(Ya(v)) + 0.5); ctx.lineTo(w - mr, Math.round(Ya(v)) + 0.5); ctx.stroke();
			ctx.fillStyle = pal.muted; ctx.fillText(G.num(v, 1), ml - 6, Ya(v));
		});
		[-L.umax, 0, L.umax].forEach(function (v) {
			ctx.strokeStyle = pal.grid; ctx.beginPath(); ctx.moveTo(ml, Math.round(Yb(v)) + 0.5); ctx.lineTo(w - mr, Math.round(Yb(v)) + 0.5); ctx.stroke();
			ctx.fillStyle = pal.muted; ctx.fillText(G.num(v, 0), ml - 6, Yb(v));
		});

		// tolerance band, target, overshoot limit, settling-time limit
		ctx.fillStyle = pal.accent; ctx.globalAlpha = 0.14;
		ctx.fillRect(ml, Ya(1.02), pw, Ya(0.98) - Ya(1.02)); ctx.globalAlpha = 1;
		dashed(ctx, ml, Ya(1), w - mr, Ya(1), pal.accent, [6, 4]);
		var osY = Ya(1 + L.os / 100);
		dashed(ctx, ml, osY, w - mr, osY, pal.bad, [2, 4]);
		ctx.fillStyle = pal.bad; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
		ctx.fillText(tr('limit') + ' +' + G.num(L.os, 0) + ' %', w - mr - 4, osY - 2);
		dashed(ctx, X(L.ts), top1, X(L.ts), top1 + h1, pal.bad, [2, 4]);
		if (L.dist) {
			dashed(ctx, X(L.dist.t), top1, X(L.dist.t), top2 + h2, pal.warn, [4, 3]);
			ctx.fillStyle = pal.warn; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
			ctx.fillText(tr('load'), X(L.dist.t) + 4, top1 + 2);
		}
		ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = pal.muted;
		ctx.fillText(tr('output'), ml + 4, top1 + 2);
		// top right of its panel: a saturated command starts out along the top left
		ctx.textAlign = 'right';
		ctx.fillText(tr('command'), w - mr - 4, top2 + 2);

		// the response itself, clipped to its panel
		trace(ctx, sim.y, X, Ya, top1, h1, ml, pw, pal.accent, 2.2);
		trace(ctx, sim.u, X, Yb, top2, h2, ml, pw, pal.muted, 1.4);

		if (sim.m.settle !== null && !sim.m.unstable) {
			var col = sim.m.settle <= L.ts ? pal.good : pal.bad;
			dashed(ctx, X(sim.m.settle), top1, X(sim.m.settle), top1 + h1, col, [5, 3]);
			ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
			ctx.fillText(G.num(sim.m.settle, 2) + ' s', X(sim.m.settle) + 4, top1 + h1 - 2);
		}
		if (sim.m.unstable) G.banner(ctx, pal, w, h, [tr('unstable')]);
	}

	function trace(ctx, arr, X, Yf, top, hh, ml, pw, colour, lw) {
		ctx.save();
		ctx.beginPath(); ctx.rect(ml, top, pw, hh); ctx.clip();
		ctx.strokeStyle = colour; ctx.lineWidth = lw; ctx.lineJoin = 'round';
		ctx.beginPath();
		var stride = Math.max(1, Math.floor(sim.n / (pw * 1.5)));
		for (var i = 0; i < sim.n; i += stride) {
			var x = X(sim.t[i]), y = Yf(Math.max(-50, Math.min(50, arr[i])));
			if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
		}
		ctx.stroke();
		ctx.restore();
	}
	function dashed(ctx, x0, y0, x1, y1, colour, dash) {
		ctx.save(); ctx.strokeStyle = colour; ctx.lineWidth = 1.2; ctx.setLineDash(dash);
		ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore();
	}

	Object.keys(sliders).forEach(function (k) { sliders[k].addEventListener('input', function () { run(false); }); });
	section.querySelectorAll('[data-level]').forEach(function (b, j) { b.addEventListener('click', function () { setLevel(j); }); });
	section.querySelector('[data-act="reset"]').addEventListener('click', function () { setGains(L.init); });
	stage.onResize = function () { if (sim) draw(); };
	G.onScheme(function () { pal = G.palette(section); draw(); });

	setLevel(0);
	G.games.pid = { Core: Core, get state() { return { level: L.id, gains: gains(), m: sim.m, stars: stars.slice() }; } };
})(typeof window !== 'undefined' ? window : this);
