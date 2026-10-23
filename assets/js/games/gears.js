/* Gear Train: turn the output shaft at the target speed and direction with as
 * few gears as possible.
 *
 * Gears that mesh turn opposite ways and trade speed for the ratio of their
 * teeth; gears on a shared shaft turn together. Speeds are kept as exact
 * fractions, so a match is a match and not a rounding accident.
 */
(function (root) {
	'use strict';

	var Core = (function () {
		var TEETH = [12, 18, 24, 36, 48, 60];
		var IDLER = 18;                 // an idler's size changes nothing but direction
		var INPUT = 1200;               // rpm, clockwise (+1)
		var MAX_STAGES = 3;

		/* stage: { a: driver teeth, b: driven teeth, idler: bool } */
		function evaluate(stages) {
			var num = INPUT, den = 1, dir = 1, gears = 0;
			stages.forEach(function (s) {
				num *= s.a; den *= s.b;
				dir *= s.idler ? 1 : -1;            // one mesh flips, two (through an idler) do not
				gears += s.idler ? 3 : 2;
			});
			var g = gcd(num, den);
			return { num: num / g, den: den / g, rpm: num / den, dir: dir, gears: gears };
		}
		function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }
		function matches(r, L) { return r.dir === L.dir && r.num === L.rpm * r.den; }

		/* The fewest gears that hit a target, by exhaustive search: 72 choices per stage. */
		function fewest(L) {
			var best = null;
			(function walk(stages) {
				if (stages.length) {
					var r = evaluate(stages);
					if (matches(r, L) && (!best || r.gears < best.gears)) best = { gears: r.gears, stages: stages.slice() };
				}
				if (stages.length === MAX_STAGES) return;
				TEETH.forEach(function (a) { TEETH.forEach(function (b) { [false, true].forEach(function (i) {
					stages.push({ a: a, b: b, idler: i }); walk(stages); stages.pop();
				}); }); });
			})([]);
			return best;
		}

		/* best: the fewest gears that do it, found by fewest() and checked by
		 * .tools/test-games.js, so the page does not have to search. */
		var LEVELS = [
			{ id: 1, rpm: 600, dir: -1, best: 2 },
			{ id: 2, rpm: 3000, dir: -1, best: 2 },
			{ id: 3, rpm: 400, dir: 1, best: 3 },
			{ id: 4, rpm: 2000, dir: 1, best: 3 },
			{ id: 5, rpm: 150, dir: 1, best: 4 },
			{ id: 6, rpm: 1000, dir: 1, best: 4 },
			{ id: 7, rpm: 75, dir: -1, best: 5 },
			{ id: 8, rpm: 16, dir: -1, best: 6 }
		];
		var START = [{ a: 24, b: 24, idler: false }];

		/* Three stars for the fewest gears, two for up to three more, one otherwise. */
		function stars(r, L) { return !matches(r, L) ? 0 : r.gears <= L.best ? 3 : r.gears <= L.best + 3 ? 2 : 1; }

		/* Where every gear sits and how it turns, in module units (pitch radius =
		 * teeth / 2). Each gear's angle is k * inputAngle + p. Meshing gears get a
		 * phase that puts a tooth of one in a gap of the other at the contact
		 * point, and keeps it there as they roll; gears on a shared shaft turn as
		 * one. Stages leave the shaft at alternating angles so the drawing zig-zags
		 * instead of running off the side. */
		function layout(stages) {
			var gears = [], shafts = [];
			var x = 0, y = 0, k = 1, p = 0;
			shafts.push({ x: 0, y: 0, k: 1 });
			function mesh(A, nB, phi, plane, role) {
				var rA = A.n / 2, rB = nB / 2;
				var B = { n: nB, x: A.x + (rA + rB) * Math.cos(phi), y: A.y + (rA + rB) * Math.sin(phi), plane: plane, role: role };
				B.k = -(A.n / nB) * A.k;
				B.p = phi + Math.PI - Math.PI / nB - (A.n / nB) * (A.p - phi);
				return B;
			}
			stages.forEach(function (s, i) {
				var phi = (i % 2 ? -1 : 1) * 0.42;
				var drv = { n: s.a, x: x, y: y, k: k, p: p, plane: i, role: i === 0 ? 'in' : 'drv' };
				gears.push(drv);
				var from = drv;
				if (s.idler) { from = mesh(drv, IDLER, phi, i, 'idler'); gears.push(from); shafts.push({ x: from.x, y: from.y, k: from.k, idler: true }); }
				var dvn = mesh(from, s.b, phi, i, i === stages.length - 1 ? 'out' : 'dvn');
				gears.push(dvn);
				shafts.push({ x: dvn.x, y: dvn.y, k: dvn.k });
				x = dvn.x; y = dvn.y; k = dvn.k; p = dvn.p;
			});
			return { gears: gears, shafts: shafts };
		}

		return { TEETH: TEETH, IDLER: IDLER, INPUT: INPUT, MAX_STAGES: MAX_STAGES, LEVELS: LEVELS, START: START,
			evaluate: evaluate, matches: matches, stars: stars, fewest: fewest, layout: layout };
	})();

	if (typeof document === 'undefined') { module.exports = Core; return; }
	var G = root.JKGames;
	var section = document.getElementById('gears');
	if (!G || !section) return;

	var S = {
		en: { hints: ['Half the input speed, turning the other way. Meshing gears trade speed for teeth: the driven gear turns at the driver’s speed × driver teeth ÷ driven teeth, and in the opposite direction.',
				'Two and a half times faster. To speed up, let a big gear drive a small one.',
				'A third of the speed, but in the same direction as the input. Every mesh reverses the direction; an idler gear between two others puts it back without changing the ratio.',
				'Faster, and still turning with the input. The idler’s own size does not matter: whatever it gains on one side it gives back on the other.',
				'An eighth of the speed. No single pair of these gears goes below 1 : 5, so add a second stage: two gears fixed on one shaft turn together, and the stage ratios multiply.',
				'Five sixths of the speed, which no single pair of these gears can make. Find two stage ratios whose product is 5/6; two meshes also cancel each other’s reversal.',
				'A sixteenth of the speed, turning backwards. Two stages give the ratio; something else has to fix the direction.',
				'A 75 : 1 reduction, the kind a winch or a clock needs. It takes all three stages: factor 75 first.'],
			level: 'Level {n}', target: 'Target', input: 'Input', output: 'Output', rpm: 'rpm',
			cw: 'clockwise', ccw: 'anticlockwise', brief: 'Level {n} · {rpm} rpm, {dir}.',
			stage: 'Stage {n}', driver: 'Driver', driven: 'Driven', idler: 'Idler', teeth: '{n} teeth', remove: 'Remove stage {n}',
			readout: 'Output: {rpm} rpm, {dir} · {g} gears', stars: '{n} of 3 stars',
			solved: 'Solved with {g} gears: {s}.', fewer: ' It can be done with {b}.', fewest: ' That is the fewest possible.',
			wrongDir: 'Right speed, wrong direction.',
			aria: 'Gear train of {g} gears. Input {i} rpm {d1}, output {o} rpm {d2}.' },
		fr: { hints: ['La moitié de la vitesse d’entrée, dans l’autre sens. Deux roues qui engrènent échangent vitesse contre dents : la roue menée tourne à la vitesse de la menante × dents de la menante ÷ dents de la menée, et en sens inverse.',
				'Deux fois et demie plus vite. Pour accélérer, faites mener une petite roue par une grande.',
				'Le tiers de la vitesse, mais dans le sens de l’entrée. Chaque engrènement inverse le sens ; une roue intermédiaire placée entre deux autres le rétablit sans changer le rapport.',
				'Plus vite, et toujours dans le sens de l’entrée. La taille de la roue intermédiaire ne compte pas : ce qu’elle gagne d’un côté, elle le rend de l’autre.',
				'Le huitième de la vitesse. Aucun couple de ces roues ne descend sous 1 : 5 : ajoutez un deuxième étage. Deux roues calées sur le même arbre tournent ensemble, et les rapports des étages se multiplient.',
				'Les cinq sixièmes de la vitesse, ce qu’aucun couple de ces roues ne donne seul. Cherchez deux rapports dont le produit vaut 5/6 ; deux engrènements annulent aussi leurs inversions.',
				'Le seizième de la vitesse, en sens inverse. Deux étages donnent le rapport ; il faut autre chose pour le sens.',
				'Une réduction de 75 : 1, celle d’un treuil ou d’une horloge. Il faut les trois étages : décomposez d’abord 75.'],
			level: 'Niveau {n}', target: 'Objectif', input: 'Entrée', output: 'Sortie', rpm: 'tr/min',
			cw: 'sens horaire', ccw: 'sens antihoraire', brief: 'Niveau {n} · {rpm} tr/min, {dir}.',
			stage: 'Étage {n}', driver: 'Menante', driven: 'Menée', idler: 'Intermédiaire', teeth: '{n} dents', remove: 'Retirer l’étage {n}',
			readout: 'Sortie : {rpm} tr/min, {dir} · {g} roues', stars: '{n} étoile(s) sur 3',
			solved: 'Résolu avec {g} roues : {s}.', fewer: ' On peut le faire avec {b}.', fewest: ' C’est le minimum possible.',
			wrongDir: 'Bonne vitesse, mauvais sens.',
			aria: 'Train de {g} roues dentées. Entrée {i} tr/min {d1}, sortie {o} tr/min {d2}.' },
		zh: { hints: ['输入转速的一半，方向相反。相互啮合的齿轮用齿数换转速：从动轮转速 = 主动轮转速 × 主动轮齿数 ÷ 从动轮齿数，且转向相反。',
				'快两倍半。要升速，就让大齿轮带动小齿轮。',
				'三分之一的转速，但与输入同向。每一次啮合都会让转向反过来；在两个齿轮之间加一个惰轮，可以把转向改回来而不改变传动比。',
				'更快，而且仍与输入同向。惰轮本身的大小无关紧要：它在一边得到多少，就在另一边还回多少。',
				'八分之一的转速。这些齿轮中任何一对都低不过 1 : 5，所以要加第二级：固定在同一根轴上的两个齿轮一起转动，各级传动比相乘。',
				'六分之五的转速，这些齿轮中没有哪一对能单独做到。找出乘积为 5/6 的两个传动比；两次啮合的反向也会互相抵消。',
				'十六分之一的转速，反向转动。两级可以得到传动比，转向还得另想办法。',
				'75 : 1 的减速比，绞车或时钟需要的那种。三级都要用上：先把 75 分解因数。'],
			level: '第 {n} 关', target: '目标', input: '输入', output: '输出', rpm: 'r/min',
			cw: '顺时针', ccw: '逆时针', brief: '第 {n} 关 · {rpm} r/min，{dir}。',
			stage: '第 {n} 级', driver: '主动轮', driven: '从动轮', idler: '惰轮', teeth: '{n} 齿', remove: '移除第 {n} 级',
			readout: '输出：{rpm} r/min，{dir} · {g} 个齿轮', stars: '{n}/3 颗星',
			solved: '用 {g} 个齿轮完成：{s}。', fewer: '最少只需 {b} 个。', fewest: '这已是最少。',
			wrongDir: '转速对了，方向反了。',
			aria: '由 {g} 个齿轮组成的轮系。输入 {i} r/min，{d1}；输出 {o} r/min，{d2}。' }
	};
	function tr(k, v) { return G.t(S, k, v); }
	function dirWord(d) { return tr(d > 0 ? 'cw' : 'ccw'); }
	function rpmText(r) { return Math.abs(r - Math.round(r)) < 1e-9 ? String(Math.round(r)) : '≈ ' + G.num(r, 1); }

	var canvas = section.querySelector('canvas');
	var statusEl = section.querySelector('.game__status');
	var nameEl = section.querySelector('.game__name'), hintEl = section.querySelector('.game__hint');
	var list = section.querySelector('.gears__stages');
	var addBtn = section.querySelector('[data-act="add"]');
	var readout = section.querySelector('.gears__readout');
	var stage = new G.Stage(canvas, { aspect: function (w) { return w < 560 ? 1.25 : 2.4; }, maxH: 400 });
	var pal = G.palette(section);

	var stars = G.store.get('gears:stars', Core.LEVELS.map(function () { return 0; }));
	var li = 0, L = Core.LEVELS[0], train = [], res = null, geo = null;
	var angle = 0, raf = 0, last = 0, visible = true;

	function clone(st) { return st.map(function (s) { return { a: s.a, b: s.b, idler: !!s.idler }; }); }
	function valid(st) {
		return Array.isArray(st) && st.length >= 1 && st.length <= Core.MAX_STAGES && st.every(function (s) {
			return s && Core.TEETH.indexOf(s.a) >= 0 && Core.TEETH.indexOf(s.b) >= 0;
		});
	}

	function setLevel(i) {
		li = i; L = Core.LEVELS[i];
		section.querySelectorAll('[data-level]').forEach(function (b, j) { b.setAttribute('aria-pressed', String(j === i)); });
		nameEl.textContent = tr('brief', { n: L.id, rpm: L.rpm, dir: dirWord(L.dir) });
		hintEl.textContent = (S[G.lang] || S.en).hints[i];
		var saved = G.store.get('gears:train:' + L.id, null);
		train = clone(valid(saved) ? saved : Core.START);
		statusEl.textContent = '';
		rows(); update(true);
	}

	/* One row per stage: driver, optional idler, driven, remove. */
	function rows() {
		list.innerHTML = '';
		train.forEach(function (s, i) {
			var li_ = document.createElement('li'); li_.className = 'gears__stage';
			var h = document.createElement('span'); h.className = 'gears__n'; h.textContent = tr('stage', { n: i + 1 });
			li_.appendChild(h);
			li_.appendChild(picker(tr('driver'), s.a, function (v) { s.a = v; }));
			var idl = document.createElement('button');
			idl.type = 'button'; idl.className = 'game__chip gears__idler'; idl.textContent = tr('idler');
			idl.setAttribute('aria-pressed', String(s.idler));
			idl.addEventListener('click', function () { s.idler = !s.idler; idl.setAttribute('aria-pressed', String(s.idler)); update(); });
			li_.appendChild(idl);
			li_.appendChild(picker(tr('driven'), s.b, function (v) { s.b = v; }));
			var rm = document.createElement('button');
			rm.type = 'button'; rm.className = 'game__chip gears__remove'; rm.textContent = '×';
			rm.setAttribute('aria-label', tr('remove', { n: i + 1 }));
			rm.disabled = train.length === 1;
			rm.addEventListener('click', function () {
				train.splice(i, 1); rows(); update();
				var b = list.querySelectorAll('.gears__remove');
				(b[Math.min(i, b.length - 1)].disabled ? addBtn : b[Math.min(i, b.length - 1)]).focus();
			});
			li_.appendChild(rm);
			list.appendChild(li_);
		});
		addBtn.disabled = train.length >= Core.MAX_STAGES;
	}
	function picker(label, value, set) {
		var l = document.createElement('label'); l.className = 'gears__pick';
		var sp = document.createElement('span'); sp.textContent = label; l.appendChild(sp);
		var sel = document.createElement('select');
		Core.TEETH.forEach(function (n) {
			var o = document.createElement('option'); o.value = n; o.textContent = tr('teeth', { n: n });
			if (n === value) o.selected = true;
			sel.appendChild(o);
		});
		sel.addEventListener('change', function () { set(parseInt(sel.value, 10)); update(); });
		l.appendChild(sel);
		return l;
	}

	function update(quiet) {
		res = Core.evaluate(train);
		geo = Core.layout(train);
		G.store.set('gears:train:' + L.id, train);
		var st = Core.stars(res, L);
		if (st > stars[li]) { stars[li] = st; G.store.set('gears:stars', stars); }
		paintStars();
		readout.textContent = tr('readout', { rpm: rpmText(res.rpm), dir: dirWord(res.dir), g: res.gears });
		var msg = '';
		if (st) msg = tr('solved', { g: res.gears, s: tr('stars', { n: st }) }) + (res.gears > L.best ? tr('fewer', { b: L.best }) : tr('fewest'));
		else if (res.num === L.rpm * res.den) msg = tr('wrongDir');
		if (!quiet || st) statusEl.textContent = msg;
		section.classList.toggle('is-right', !!st);
		section.classList.toggle('is-wrong', !st && msg !== '');
		canvas.setAttribute('aria-label', tr('aria', { g: res.gears, i: Core.INPUT, d1: dirWord(1), o: rpmText(res.rpm), d2: dirWord(res.dir) }));
		draw();
		animate();
	}

	function paintStars() {
		section.querySelectorAll('[data-level]').forEach(function (b, j) {
			G.stars(b.querySelector('.game__stars'), stars[j]);
			b.setAttribute('aria-label', tr('level', { n: j + 1 }) + (G.lang === 'zh' ? '，' : ', ') + tr('stars', { n: stars[j] }));
		});
	}

	// ---------------------------------------------------------------- drawing
	var ADD = 1, DED = 1.25;                       // addendum and dedendum, in modules
	var TAN = Math.tan(20 * Math.PI / 180);       // 20° pressure angle, for the flank slope

	function gearPath(ctx, g, cx, cy, s, th) {
		var r = g.n / 2, ro = r + ADD, rr = r - DED;
		var aTip = (Math.PI / 2 - 2 * ADD * TAN) / (2 * ro);       // half the tooth's angular width at the tip
		var aRoot = (Math.PI / 2 + 2 * DED * TAN) / (2 * rr);      // and at the root
		var step = 2 * Math.PI / g.n;
		ctx.beginPath();
		for (var j = 0; j < g.n; j++) {
			var c = th + j * step;
			var p0 = c - aRoot, p1 = c - aTip, p2 = c + aTip, p3 = c + aRoot;
			if (j === 0) ctx.moveTo(cx + rr * s * Math.cos(p0), cy + rr * s * Math.sin(p0));
			else ctx.arc(cx, cy, rr * s, c - step + aRoot, p0);
			ctx.lineTo(cx + ro * s * Math.cos(p1), cy + ro * s * Math.sin(p1));
			ctx.arc(cx, cy, ro * s, p1, p2);
			ctx.lineTo(cx + rr * s * Math.cos(p3), cy + rr * s * Math.sin(p3));
		}
		ctx.arc(cx, cy, rr * s, th + (g.n - 1) * step + aRoot, th + g.n * step - aRoot);
		ctx.closePath();
	}

	/* A curved arrow just outside a gear, centred on angle mid, showing which way it turns. */
	function turnArrow(ctx, cx, cy, rad, dir, colour, lw, mid, span) {
		var a0 = mid - span / 2, a1 = mid + span / 2;
		ctx.save();
		ctx.strokeStyle = colour; ctx.fillStyle = colour; ctx.lineWidth = lw; ctx.lineCap = 'round';
		ctx.beginPath(); ctx.arc(cx, cy, rad, a0, a1); ctx.stroke();
		var tip = dir > 0 ? a1 : a0, tx = cx + rad * Math.cos(tip), ty = cy + rad * Math.sin(tip);
		var tang = tip + (dir > 0 ? Math.PI / 2 : -Math.PI / 2), hl = lw * 3.6;
		ctx.beginPath();
		ctx.moveTo(tx + hl * Math.cos(tang), ty + hl * Math.sin(tang));
		ctx.lineTo(tx + hl * 0.75 * Math.cos(tang + 2.2), ty + hl * 0.75 * Math.sin(tang + 2.2));
		ctx.lineTo(tx + hl * 0.75 * Math.cos(tang - 2.2), ty + hl * 0.75 * Math.sin(tang - 2.2));
		ctx.closePath(); ctx.fill();
		ctx.restore();
	}

	function icon(ctx, x, y, size, dir, colour) {     // the same arrow, as a glyph after a label
		turnArrow(ctx, x + size / 2, y + size / 2, size * 0.34, dir, colour, Math.max(1.4, size / 8), Math.PI * 1.25, Math.PI * 1.35);
	}

	function draw() {
		if (!geo) return;
		var ctx = stage.ctx, w = stage.w, h = stage.h;
		var fs = Math.max(12, Math.min(15, w / 56));
		var solved = Core.matches(res, L);
		ctx.fillStyle = pal.panel; ctx.fillRect(0, 0, w, h);

		// fit every gear and both turning arrows, leaving room for the labels
		var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
		geo.gears.forEach(function (g) {
			var r = g.n / 2 + ADD + (g.role === 'in' || g.role === 'out' ? 3 : 0);
			x0 = Math.min(x0, g.x - r); x1 = Math.max(x1, g.x + r);
			y0 = Math.min(y0, g.y - r); y1 = Math.max(y1, g.y + r);
		});
		var top = fs * 2.2, bottom = fs * 2.2, side = 12;
		var s = Math.min((w - 2 * side) / (x1 - x0), (h - top - bottom) / (y1 - y0), w / 95);
		var ox = (w - (x1 - x0) * s) / 2 - x0 * s, oy = top + (h - top - bottom - (y1 - y0) * s) / 2 - y0 * s;

		// back stages first, so each compound gear sits in front of the one it shares a shaft with
		var order = geo.gears.slice().sort(function (a, b) { return a.plane - b.plane; });
		order.forEach(function (g) {
			var fill = g.role === 'in' ? pal.gearIn : g.role === 'out' ? (solved ? pal.gearDone : pal.gearOut) : g.role === 'idler' ? pal.metal2 : pal.metal1;
			gearPath(ctx, g, ox + g.x * s, oy + g.y * s, s, g.k * angle + g.p);
			ctx.globalAlpha = 0.9; ctx.fillStyle = fill; ctx.fill(); ctx.globalAlpha = 1;
			// on a pale page the outline, not the pastel fill, is what sets a gear off
			ctx.strokeStyle = pal.metalInk; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.8; ctx.stroke(); ctx.globalAlpha = 1;
			// a spoke, so a slow gear can still be seen to turn
			var cx = ox + g.x * s, cy = oy + g.y * s, th = g.k * angle + g.p, rr = (g.n / 2 - DED) * s;
			ctx.strokeStyle = pal.metalInk; ctx.globalAlpha = 0.35; ctx.lineWidth = Math.max(1.5, s * 0.6);
			ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + rr * 0.75 * Math.cos(th), cy + rr * 0.75 * Math.sin(th)); ctx.stroke();
			ctx.globalAlpha = 1;
		});
		geo.shafts.forEach(function (sh) {
			ctx.beginPath(); ctx.arc(ox + sh.x * s, oy + sh.y * s, Math.max(3, s * 1.5), 0, 2 * Math.PI);
			ctx.fillStyle = pal.panel; ctx.fill();
			ctx.strokeStyle = pal.metalInk; ctx.lineWidth = 1.2; ctx.stroke();
		});

		// the arrows go on the free side of each gear, away from its mesh
		var gs = geo.gears, gin = gs[0], gout = gs[gs.length - 1], nxt = gs[1], prv = gs[gs.length - 2];
		var lw = Math.max(2, fs / 6);
		turnArrow(ctx, ox + gin.x * s, oy + gin.y * s, (gin.n / 2 + ADD + 1.8) * s, 1, pal.accent, lw,
			Math.atan2(gin.y - nxt.y, gin.x - nxt.x), Math.PI * 0.55);
		turnArrow(ctx, ox + gout.x * s, oy + gout.y * s, (gout.n / 2 + ADD + 1.8) * s, res.dir, solved ? pal.good : pal.warn, lw,
			Math.atan2(gout.y - prv.y, gout.x - prv.x), Math.PI * 0.55);

		// labels: input top left, target top right, output bottom
		ctx.textBaseline = 'middle';
		label(ctx, side, fs * 1.1, 'left', tr('input') + ' ' + Core.INPUT + ' ' + tr('rpm'), 1, pal.accent, fs);
		label(ctx, w - side, fs * 1.1, 'right', tr('target') + ' ' + L.rpm + ' ' + tr('rpm'), L.dir, pal.ink, fs);
		label(ctx, w - side, h - fs * 1.1, 'right', tr('output') + ' ' + rpmText(res.rpm) + ' ' + tr('rpm') + (solved ? '  ✓' : ''), res.dir, solved ? pal.good : pal.ink, fs);
	}
	function label(ctx, x, y, align, text, dir, colour, fs) {
		ctx.font = G.font(fs, 600);
		var tw = ctx.measureText(text).width, iz = fs * 1.15, gap = fs * 0.35;
		var left = align === 'left' ? x : x - tw - gap - iz;
		ctx.fillStyle = colour; ctx.textAlign = 'left';
		ctx.fillText(text, left, y);
		icon(ctx, left + tw + gap, y - iz * 0.62, iz, dir, colour);
	}

	// ---------------------------------------------------------------- motion
	/* The input turns slowly enough to watch, and slower still if that would
	 * make the fastest gear's teeth flicker past faster than ten a second. */
	function speed() {
		var fastest = 0;
		geo.gears.forEach(function (g) { fastest = Math.max(fastest, Math.abs(g.k) * g.n); });
		return Math.min(2 * Math.PI * 0.12, 2 * Math.PI * 10 / fastest);
	}
	function animate() {
		if (raf || !visible || G.reducedMotion.matches) return;
		last = performance.now();
		raf = requestAnimationFrame(frame);
	}
	function frame(now) {
		raf = 0;
		angle += speed() * Math.min(0.05, (now - last) / 1000);
		last = now;
		draw();
		animate();
	}

	section.querySelectorAll('[data-level]').forEach(function (b, j) { b.addEventListener('click', function () { setLevel(j); }); });
	addBtn.addEventListener('click', function () {
		if (train.length >= Core.MAX_STAGES) return;
		train.push({ a: 24, b: 24, idler: false }); rows(); update();
		var sel = list.querySelectorAll('select');
		sel[sel.length - 2].focus();
	});
	section.querySelector('[data-act="reset"]').addEventListener('click', function () { train = clone(Core.START); rows(); update(); });
	G.watchVisible(stage.canvas.parentElement, function (v) { visible = v; if (v) animate(); });
	stage.onResize = draw;
	G.onScheme(function () { pal = G.palette(section); draw(); });

	setLevel(0);
	G.games.gears = { Core: Core, get state() { return { level: L.id, train: clone(train), result: res, stars: stars.slice() }; } };
})(typeof window !== 'undefined' ? window : this);
