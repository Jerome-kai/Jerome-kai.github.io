/* Soft Landing: put a quadcopter down on the pad, gently, before the battery runs out.
 *
 * The physics lives in Core, which touches no DOM, so the same code can be
 * loaded under Node and checked with an autopilot: every level has to be
 * winnable before anyone is asked to play it.
 */
(function (root) {
	'use strict';

	var Core = (function () {
		// World units are metres; y is height above the ground.
		var W = 100, H = 62.5, CEILING = 57;
		var G = 9.0, THRUST = 19.5, SIDE = 6.5, DRAG = 0.35;
		var HALF_W = 3.6, LEG = 1.6, FOOT = 2.6;      // feet sit FOOT either side of centre
		var SAFE_VY = 4.2, SAFE_VX = 2.2;              // touchdown limits, m/s
		var DRAIN_THRUST = 6.2, DRAIN_SIDE = 2.2, DRAIN_IDLE = 0.4;   // battery %/s: about 30 s of hovering

		function rng(seed) {                           // mulberry32: small, seedable, good enough
			return function () {
				seed |= 0; seed = seed + 0x6D2B79F5 | 0;
				var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
				t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
				return ((t ^ t >>> 14) >>> 0) / 4294967296;
			};
		}

		/* Each level: a narrower pad, more wind, gusts. */
		function makeLevel(n, rand) {
			var padW = Math.max(9, 18 - 1.3 * (n - 1));
			var padX = 8 + padW / 2 + rand() * (W - 16 - padW);
			var startX, tries = 0;
			do { startX = 10 + rand() * (W - 20); } while (Math.abs(startX - padX) < 20 && ++tries < 60);
			var windMax = Math.min(0.55 * (n - 1), 3.5);
			var hills = [];
			for (var i = 0; i <= 12; i++) hills.push(3 + rand() * 7);
			return {
				n: n, padX: padX, padW: padW, startX: startX, hills: hills,
				wind: (rand() * 2 - 1) * windMax, gust: Math.min(0.3 * (n - 1), 1.8), phase: rand() * 6.2832
			};
		}

		function spawn(L) {
			return { x: L.startX, y: CEILING - 7, vx: 0, vy: 0, battery: 100, t: 0, tilt: 0,
				state: 'flying', thrusting: false, side: 0 };
		}

		function windAt(L, t) {
			return L.wind + L.gust * Math.sin(0.9 * t + L.phase) + 0.4 * L.gust * Math.sin(2.3 * t + 1.7 * L.phase);
		}

		function step(s, L, input, dt) {
			if (s.state !== 'flying') return s;
			var powered = s.battery > 0;
			var thrust = !!input.thrust && powered;
			var side = powered ? (input.right ? 1 : 0) - (input.left ? 1 : 0) : 0;
			s.thrusting = thrust; s.side = side;
			var ay = -G + (thrust ? THRUST : 0);
			var ax = side * SIDE + windAt(L, s.t) - DRAG * s.vx;
			s.vx += ax * dt; s.vy += ay * dt;
			s.x += s.vx * dt; s.y += s.vy * dt;
			s.battery = Math.max(0, s.battery - dt * ((thrust ? DRAIN_THRUST : 0) + (side ? DRAIN_SIDE : 0) + DRAIN_IDLE));
			s.tilt += (side * 0.32 - s.tilt) * Math.min(1, dt * 8);
			s.t += dt;

			if (s.x < HALF_W) { s.x = HALF_W; if (s.vx < 0) s.vx = 0; }
			if (s.x > W - HALF_W) { s.x = W - HALF_W; if (s.vx > 0) s.vx = 0; }
			if (s.y > CEILING) { s.y = CEILING; if (s.vy > 0) s.vy = 0; }

			if (s.y - LEG <= 0) {                      // touchdown
				s.y = LEG;
				var onPad = Math.abs(s.x - L.padX) <= L.padW / 2 - FOOT + 1e-9;
				s.impact = { vy: -s.vy, vx: s.vx };
				if (!onPad) { s.state = 'crashed'; s.reason = 'pad'; }
				else if (-s.vy > SAFE_VY) { s.state = 'crashed'; s.reason = 'fast'; }
				else if (Math.abs(s.vx) > SAFE_VX) { s.state = 'crashed'; s.reason = 'side'; }
				else s.state = 'landed';
				s.vx = 0; s.vy = 0; s.thrusting = false;
			}
			return s;
		}

		function score(s, L) {
			var precision = 1 - Math.abs(s.x - L.padX) / (L.padW / 2 - FOOT);
			var soft = 1 - Math.max(0, s.impact.vy) / SAFE_VY;
			var b = { base: 100, battery: Math.round(s.battery),
				centre: Math.round(50 * Math.max(0, precision)), soft: Math.round(30 * Math.max(0, soft)) };
			b.total = b.base + b.battery + b.centre + b.soft;
			return b;
		}

		return { W: W, H: H, CEILING: CEILING, G: G, THRUST: THRUST, SIDE: SIDE, DRAG: DRAG,
			HALF_W: HALF_W, LEG: LEG, FOOT: FOOT, SAFE_VY: SAFE_VY, SAFE_VX: SAFE_VX,
			DRAIN_THRUST: DRAIN_THRUST, DRAIN_SIDE: DRAIN_SIDE, DRAIN_IDLE: DRAIN_IDLE,
			rng: rng, makeLevel: makeLevel, spawn: spawn, windAt: windAt, step: step, score: score };
	})();

	if (typeof document === 'undefined') { module.exports = Core; return; }
	var G = root.JKGames;
	var section = document.getElementById('drone');
	if (!G || !section) return;

	var S = {
		en: { level: 'Level {n}', score: 'Score {n}', best: 'Best {n}', battery: 'Battery', wind: 'Wind',
			start: 'Start', next: 'Next level', again: 'Play again', resume: 'Resume',
			ready: 'Level {n}', readyHint: 'Press Start, or Space', paused: 'Paused', pausedHint: 'Press Resume, or Space',
			landed: 'Landed! +{n}', landedDetail: 'base 100 · battery +{b} · centred +{c} · soft +{s}',
			nextHint: 'Enter for the next level',
			crashed: 'Crashed', fast: 'Came down at {v} m/s (limit {max})', side: 'Sliding sideways at {v} m/s (limit {max})',
			pad: 'Missed the pad', over: 'Score {score} · best {best}', newBest: 'New best: {score}!', againHint: 'Enter to play again',
			statusLanded: 'Landed on level {n}, {pts} points. Total {score}.',
			statusOver: 'Crashed on level {n}. Final score {score}, best {best}.',
			aria: 'Drone landing game. Level {n}, altitude {alt} metres, battery {bat} percent.' },
		fr: { level: 'Niveau {n}', score: 'Score {n}', best: 'Record {n}', battery: 'Batterie', wind: 'Vent',
			start: 'Démarrer', next: 'Niveau suivant', again: 'Rejouer', resume: 'Reprendre',
			ready: 'Niveau {n}', readyHint: 'Appuyez sur Démarrer, ou Espace', paused: 'En pause', pausedHint: 'Appuyez sur Reprendre, ou Espace',
			landed: 'Posé ! +{n}', landedDetail: 'base 100 · batterie +{b} · centrage +{c} · douceur +{s}',
			nextHint: 'Entrée pour le niveau suivant',
			crashed: 'Crash', fast: 'Arrivé à {v} m/s (limite {max})', side: 'Glissade latérale à {v} m/s (limite {max})',
			pad: 'Hors de la plateforme', over: 'Score {score} · record {best}', newBest: 'Nouveau record : {score} !', againHint: 'Entrée pour rejouer',
			statusLanded: 'Posé au niveau {n}, {pts} points. Total {score}.',
			statusOver: 'Crash au niveau {n}. Score final {score}, record {best}.',
			aria: 'Jeu d’atterrissage de drone. Niveau {n}, altitude {alt} mètres, batterie {bat} pour cent.' },
		zh: { level: '第 {n} 关', score: '得分 {n}', best: '最高 {n}', battery: '电量', wind: '风',
			start: '开始', next: '下一关', again: '再玩一次', resume: '继续',
			ready: '第 {n} 关', readyHint: '点“开始”或按空格键', paused: '已暂停', pausedHint: '点“继续”或按空格键',
			landed: '降落成功！+{n}', landedDetail: '基础 100 · 电量 +{b} · 居中 +{c} · 平稳 +{s}',
			nextHint: '按回车进入下一关',
			crashed: '坠毁', fast: '落地速度 {v} 米/秒（上限 {max}）', side: '横向滑动 {v} 米/秒（上限 {max}）',
			pad: '没有落在停机坪上', over: '得分 {score} · 最高 {best}', newBest: '新纪录：{score}！', againHint: '按回车再玩一次',
			statusLanded: '第 {n} 关降落成功，{pts} 分，总分 {score}。',
			statusOver: '在第 {n} 关坠毁。最终得分 {score}，最高 {best}。',
			aria: '无人机降落游戏。第 {n} 关，高度 {alt} 米，电量 {bat}%。' }
	};
	function tr(k, v) { return G.t(S, k, v); }

	var stageEl = section.querySelector('.game__stage');
	var canvas = section.querySelector('canvas');
	var statusEl = section.querySelector('.game__status');
	var goBtn = section.querySelector('[data-act="go"]');
	var stage = new G.Stage(canvas, { aspect: function (w) { return w < 560 ? 1.15 : 1.6; } });
	var pal = G.palette(section);

	var input = { thrust: false, left: false, right: false };
	var mode = 'ready', level = 1, total = 0, seedBase = 1;
	var best = G.store.get('drone:best', 0);
	var L, s, raf = 0, last = 0, acc = 0, after = 0, lastScore = null, wasBest = false;
	var particles = [];
	var STEP = 1 / 120;

	function newGame() {
		seedBase = (Math.random() * 1e9) | 0;
		level = 1; total = 0; wasBest = false;
		loadLevel();
	}
	function loadLevel() {
		L = Core.makeLevel(level, Core.rng(seedBase + level * 7919));
		s = Core.spawn(L);
		particles = [];
		mode = 'ready';
		setGo(tr('start'));
		draw();
	}
	function setGo(label) { goBtn.textContent = label; }

	function launch() {
		if (mode !== 'ready' && mode !== 'paused') return;
		mode = 'flying'; last = 0; acc = 0;
		setGo(tr('resume')); goBtn.disabled = true;
		if (!raf) raf = requestAnimationFrame(loop);
	}
	function action() {                 // Enter, Space, or the main button
		if (mode === 'ready' || mode === 'paused') launch();
		else if (mode === 'landed') { level++; loadLevel(); }
		else if (mode === 'over') newGame();
	}

	function finish() {
		goBtn.disabled = false;
		if (s.state === 'landed') {
			lastScore = Core.score(s, L);
			total += lastScore.total;
			mode = 'landed';
			setGo(tr('next'));
			statusEl.textContent = tr('statusLanded', { n: level, pts: lastScore.total, score: total });
			dust(18);
		} else {
			mode = 'over';
			wasBest = total > best;
			if (wasBest) { best = total; G.store.set('drone:best', best); }
			setGo(tr('again'));
			statusEl.textContent = tr('statusOver', { n: level, score: total, best: best });
			debris();
		}
		after = 1.4;                    // let the dust and debris settle on screen
	}

	function loop(ts) {
		raf = 0;
		var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
		last = ts;
		if (mode === 'flying') {
			acc += dt;
			while (acc >= STEP && s.state === 'flying') { Core.step(s, L, input, STEP); acc -= STEP; }
			if (s.thrusting) wash(dt);
			if (s.state !== 'flying') finish();
		} else after -= dt;
		stepParticles(dt);
		draw();
		if (mode === 'flying' || after > 0) raf = requestAnimationFrame(loop);
	}

	// ---------------------------------------------------------------- particles
	function wash(dt) {
		var n = Math.min(4, Math.round(60 * dt) + 1);
		for (var i = 0; i < n && particles.length < 160; i++) {
			var side = Math.random() < 0.5 ? -1 : 1;
			particles.push({ x: s.x + side * Core.FOOT * 1.1, y: s.y - 0.4, vx: s.vx + (Math.random() - 0.5) * 3,
				vy: s.vy - 9 - Math.random() * 5, life: 0.45 + Math.random() * 0.2, max: 0.6, kind: 'wash' });
		}
	}
	function dust(n) {
		for (var i = 0; i < n; i++) particles.push({ x: s.x + (Math.random() - 0.5) * 4, y: 0.2, vx: (Math.random() - 0.5) * 14,
			vy: Math.random() * 3, life: 0.6 + Math.random() * 0.5, max: 1.1, kind: 'dust' });
	}
	function debris() {
		for (var i = 0; i < 26; i++) particles.push({ x: s.x, y: s.y, vx: (Math.random() - 0.5) * 22,
			vy: 4 + Math.random() * 12, life: 1 + Math.random() * 0.4, max: 1.4, kind: 'debris' });
	}
	function stepParticles(dt) {
		for (var i = particles.length - 1; i >= 0; i--) {
			var p = particles[i];
			p.life -= dt;
			if (p.kind === 'debris') p.vy -= Core.G * dt;
			if (p.kind === 'wash' && p.y <= 0.15) { p.vy = Math.abs(p.vy) * 0.08; p.vx += (p.vx >= 0 ? 1 : -1) * 6; p.kind = 'dust'; }
			p.x += p.vx * dt; p.y = Math.max(0.1, p.y + p.vy * dt);
			if (p.kind !== 'wash') p.vx *= (1 - 2.5 * dt);
			if (p.life <= 0) particles.splice(i, 1);
		}
	}

	// ---------------------------------------------------------------- drawing
	function draw() {
		var ctx = stage.ctx, w = stage.w, h = stage.h;
		var gh = Math.max(14, h * 0.07);
		var sc = w / Core.W;
		function X(x) { return x * sc; }
		function Y(y) { return h - gh - y * sc; }

		var sky = ctx.createLinearGradient(0, 0, 0, h);
		sky.addColorStop(0, pal.sky1); sky.addColorStop(1, pal.sky2);
		ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

		// distant hills: scenery only, nothing collides with them
		ctx.fillStyle = pal.hill;
		ctx.beginPath(); ctx.moveTo(0, Y(0));
		L.hills.forEach(function (hh, i) {
			var x0 = X(i * Core.W / 12);
			if (i === 0) ctx.lineTo(x0, Y(hh)); else {
				var xp = X((i - 0.5) * Core.W / 12);
				ctx.quadraticCurveTo(xp, Y(L.hills[i - 1] + 1.5), x0, Y(hh));
			}
		});
		ctx.lineTo(w, Y(0)); ctx.closePath(); ctx.fill();

		ctx.fillStyle = pal.ground; ctx.fillRect(0, Y(0), w, gh + 1);
		ctx.fillStyle = pal.grid; ctx.fillRect(0, Y(0), w, 1);

		// pad
		var px0 = X(L.padX - L.padW / 2), pw = L.padW * sc, py = Y(0);
		ctx.fillStyle = pal.accent; ctx.globalAlpha = 0.9;
		ctx.fillRect(px0, py - Math.max(3, 0.5 * sc), pw, Math.max(3, 0.5 * sc));
		ctx.globalAlpha = 0.25; ctx.fillRect(px0, py, pw, gh * 0.6); ctx.globalAlpha = 1;
		var blink = (performance.now() / 500 | 0) % 2 === 0 || mode !== 'flying';
		ctx.fillStyle = blink ? pal.good : pal.panel;
		[px0 + 3, px0 + pw - 3].forEach(function (lx) { ctx.beginPath(); ctx.arc(lx, py - Math.max(3, 0.5 * sc) - 2.5, 2.5, 0, 6.283); ctx.fill(); });
		ctx.fillStyle = pal.ink; ctx.font = G.font(Math.max(10, sc * 1.6), 700);
		ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.fillText('H', px0 + pw / 2, py + gh * 0.32);

		// particles
		particles.forEach(function (p) {
			var a = Math.max(0, p.life / p.max);
			ctx.globalAlpha = p.kind === 'debris' ? a : a * 0.55;
			ctx.fillStyle = p.kind === 'debris' ? pal.bad : pal.muted;
			var r = p.kind === 'debris' ? Math.max(1.5, sc * 0.3) : Math.max(1.2, sc * (p.kind === 'dust' ? 0.35 : 0.22));
			ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), r, 0, 6.283); ctx.fill();
		});
		ctx.globalAlpha = 1;

		if (!(mode === 'over' && after < 1.2)) drawDrone(ctx, X(s.x), Y(s.y), sc, s.tilt);
		drawHud(ctx, w, h, sc);

		if (mode === 'ready') G.banner(ctx, pal, w, h, [tr('ready', { n: level }), tr('readyHint')]);
		else if (mode === 'paused') G.banner(ctx, pal, w, h, [tr('paused'), tr('pausedHint')]);
		else if (mode === 'landed' && lastScore) G.banner(ctx, pal, w, h, [tr('landed', { n: lastScore.total }),
			tr('landedDetail', { b: lastScore.battery, c: lastScore.centre, s: lastScore.soft }), tr('nextHint')]);
		else if (mode === 'over') {
			var why = s.reason === 'pad' ? tr('pad') : tr(s.reason, {
				v: G.num(s.reason === 'fast' ? s.impact.vy : Math.abs(s.impact.vx), 1),
				max: G.num(s.reason === 'fast' ? Core.SAFE_VY : Core.SAFE_VX, 1) });
			G.banner(ctx, pal, w, h, [tr('crashed') + ' · ' + why,
				wasBest ? tr('newBest', { score: total }) : tr('over', { score: total, best: best }), tr('againHint')]);
		}
		canvas.setAttribute('aria-label', tr('aria', { n: level, alt: G.num(Math.max(0, s.y - Core.LEG), 0), bat: Math.round(s.battery) }));
	}

	function drawDrone(ctx, cx, cy, sc, tilt) {
		var u = sc;
		ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt);
		ctx.strokeStyle = pal.ink; ctx.lineCap = 'round';
		// legs and feet: the feet are where the physics puts them
		ctx.lineWidth = Math.max(1.5, u * 0.22);
		[-1, 1].forEach(function (d) {
			ctx.beginPath(); ctx.moveTo(d * u * 1.1, u * 0.35); ctx.lineTo(d * u * Core.FOOT, u * Core.LEG); ctx.stroke();
			ctx.beginPath(); ctx.moveTo(d * u * (Core.FOOT - 0.6), u * Core.LEG); ctx.lineTo(d * u * (Core.FOOT + 0.6), u * Core.LEG); ctx.stroke();
		});
		// arms
		ctx.lineWidth = Math.max(2, u * 0.32);
		ctx.beginPath(); ctx.moveTo(-u * 3, -u * 0.25); ctx.lineTo(u * 3, -u * 0.25); ctx.stroke();
		// rotors: a blur disc that brightens under thrust
		var spin = s.thrusting ? 1 : (mode === 'flying' ? 0.55 : 0.0);
		[-1, 1].forEach(function (d) {
			ctx.fillStyle = pal.ink;
			ctx.fillRect(d * u * 3 - u * 0.15, -u * 0.75, u * 0.3, u * 0.5);
			if (spin > 0) {
				var flick = 0.85 + 0.15 * Math.sin(performance.now() / 22 + d);
				ctx.globalAlpha = 0.25 + 0.4 * spin;
				ctx.fillStyle = pal.accent;
				ctx.beginPath(); ctx.ellipse(d * u * 3, -u * 0.8, u * 1.5 * flick, Math.max(1, u * 0.16), 0, 0, 6.283); ctx.fill();
				ctx.globalAlpha = 1;
			} else {
				ctx.fillRect(d * u * 3 - u * 1.3, -u * 0.86, u * 2.6, Math.max(1, u * 0.12));
			}
		});
		// body
		ctx.fillStyle = pal.panel; ctx.strokeStyle = pal.ink; ctx.lineWidth = Math.max(1, u * 0.12);
		G.roundRect(ctx, -u * 1.5, -u * 0.6, u * 3, u * 1.1, u * 0.35); ctx.fill(); ctx.stroke();
		ctx.fillStyle = (performance.now() / 300 | 0) % 2 ? pal.bad : pal.accent;
		ctx.beginPath(); ctx.arc(u * 1.05, -u * 0.05, Math.max(1.2, u * 0.18), 0, 6.283); ctx.fill();
		ctx.restore();
	}

	function drawHud(ctx, w, h, sc) {
		var f = Math.max(12, Math.min(16, w / 52));
		var pad = f * 0.8;
		ctx.textBaseline = 'top'; ctx.textAlign = 'left';
		ctx.font = G.font(f, 600); ctx.fillStyle = pal.ink;
		ctx.fillText(tr('level', { n: level }) + '   ' + tr('score', { n: total }), pad, pad);
		ctx.font = G.font(f * 0.85); ctx.fillStyle = pal.muted;
		ctx.fillText(tr('best', { n: best }), pad, pad + f * 1.35);

		// battery, top right
		var bw = Math.max(70, w * 0.14), bh = f * 0.75, bx = w - pad - bw, by = pad + f * 0.15;
		ctx.textAlign = 'right'; ctx.font = G.font(f * 0.85); ctx.fillStyle = pal.muted;
		ctx.fillText(tr('battery') + ' ' + Math.round(s.battery) + '%', bx - 8, pad);
		ctx.strokeStyle = pal.muted; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bw, bh);
		ctx.fillStyle = s.battery > 30 ? pal.good : s.battery > 12 ? pal.warn : pal.bad;
		ctx.fillRect(bx + 2, by + 2, Math.max(0, (bw - 3) * s.battery / 100), bh - 3);

		// wind, under the battery
		var wv = Core.windAt(L, s.t);
		ctx.fillStyle = pal.muted;
		ctx.fillText(tr('wind') + ' ' + G.num(Math.abs(wv), 1), w - pad - bw - 8 + (bw + 8), by + bh + f * 0.55);
		var ax0 = w - pad - bw * 0.5 - 30, ay0 = by + bh + f * 1.15;
		var len = Math.max(-26, Math.min(26, wv * 7));
		if (Math.abs(len) > 1) {
			ctx.strokeStyle = pal.muted; ctx.lineWidth = 2;
			ctx.beginPath(); ctx.moveTo(ax0 - len, ay0); ctx.lineTo(ax0 + len, ay0);
			var d = len > 0 ? 1 : -1;
			ctx.lineTo(ax0 + len - d * 5, ay0 - 4); ctx.moveTo(ax0 + len, ay0); ctx.lineTo(ax0 + len - d * 5, ay0 + 4);
			ctx.stroke();
		}

		// telemetry, bottom left: green while inside the touchdown limits
		var down = -s.vy, alt = Math.max(0, s.y - Core.LEG);
		var rows = [
			['ALT ' + G.num(alt, 1) + ' m', pal.ink],
			['V↓ ' + G.num(down, 1) + ' m/s', down <= Core.SAFE_VY ? pal.good : pal.bad],
			['V→ ' + G.num(Math.abs(s.vx), 1) + ' m/s', Math.abs(s.vx) <= Core.SAFE_VX ? pal.good : pal.bad]
		];
		ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.font = G.font(f * 0.85, 600);
		var gh = Math.max(14, h * 0.07);
		rows.forEach(function (r, i) {
			ctx.fillStyle = r[1];
			ctx.fillText(r[0], pad, h - gh - pad - (rows.length - 1 - i) * f * 1.15);
		});
	}

	// ---------------------------------------------------------------- input
	var KEYS = { ArrowUp: 'thrust', KeyW: 'thrust', Space: 'thrust', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
	stageEl.addEventListener('keydown', function (e) {
		var k = KEYS[e.code];
		if (e.code === 'Enter' || (e.code === 'Space' && mode !== 'flying')) {
			e.preventDefault();
			if (!e.repeat) action();
			if (e.code === 'Space' && mode === 'flying') input.thrust = true;
			return;
		}
		if (!k) return;
		e.preventDefault();
		input[k] = true;
		if (mode === 'ready' || mode === 'paused') launch();
	});
	stageEl.addEventListener('keyup', function (e) { var k = KEYS[e.code]; if (k) { input[k] = false; e.preventDefault(); } });
	stageEl.addEventListener('blur', release);
	canvas.addEventListener('pointerdown', function () { stageEl.focus({ preventScroll: true }); });
	function release() { input.thrust = input.left = input.right = false; }

	// Hold-to-fly buttons for touch and mouse. Pointer capture keeps the thrust on
	// while the finger slides a little off the button.
	section.querySelectorAll('[data-hold]').forEach(function (b) {
		var k = b.getAttribute('data-hold');
		function down(e) {
			e.preventDefault();
			try { b.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
			input[k] = true; b.classList.add('is-held');
			if (mode === 'ready' || mode === 'paused') launch();
		}
		function up() { input[k] = false; b.classList.remove('is-held'); }
		b.addEventListener('pointerdown', down);
		['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { b.addEventListener(ev, up); });
		b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
	});
	goBtn.addEventListener('click', function () { action(); stageEl.focus({ preventScroll: true }); });

	G.watchVisible(section, function (visible) {
		if (!visible && mode === 'flying') {
			mode = 'paused'; release(); goBtn.disabled = false; setGo(tr('resume'));
			if (raf) { cancelAnimationFrame(raf); raf = 0; }
			draw();
		}
	});
	G.onScheme(function () { pal = G.palette(section); draw(); });
	stage.onResize = function () { if (L) draw(); };

	newGame();
	G.games.drone = { Core: Core, get state() { return { mode: mode, level: level, total: total, best: best, s: s, L: L }; } };
})(typeof window !== 'undefined' ? window : this);
