/* Light the LED: fill the empty gates of a small circuit so that the LED
 * follows a rule taken from a real machine.
 *
 * Each level is a fixed wiring with one or more empty gate slots. The circuit
 * is checked against every input combination at once, so a solution is a
 * solution and not a lucky guess for the switches as they happen to be set.
 * Gates are drawn with the IEC rectangular symbols used in France and China.
 */
(function (root) {
	'use strict';

	var Core = (function () {
		var FN = {
			AND: function (a, b) { return a & b; }, OR: function (a, b) { return a | b; },
			XOR: function (a, b) { return a ^ b; }, NAND: function (a, b) { return 1 - (a & b); },
			NOR: function (a, b) { return 1 - (a | b); }, NOT: function (a) { return 1 - a; }
		};
		var CHOICES = ['AND', 'OR', 'XOR', 'NAND', 'NOR'];

		/* Nodes in signal order. slot: true for a gate the player chooses; x, y
		 * place it on a grid (inputs at x = 0); out: the node driving the LED. */
		var LEVELS = [
			{ id: 1, inputs: ['A', 'B'], nodes: [{ id: 'g1', slot: true, in: ['A', 'B'], x: 3, y: 1 }], out: 'g1', led: [5.4, 1],
				rule: function (A, B) { return A & B; }, at: { A: 0, B: 2 } },
			{ id: 2, inputs: ['A', 'B'], nodes: [{ id: 'g1', slot: true, in: ['A', 'B'], x: 3, y: 1 }], out: 'g1', led: [5.4, 1],
				rule: function (A, B) { return A ^ B; }, at: { A: 0, B: 2 } },
			{ id: 3, inputs: ['A', 'B'], nodes: [{ id: 'n1', type: 'NOT', in: ['B'], x: 2, y: 2 }, { id: 'g1', slot: true, in: ['A', 'n1'], x: 4.4, y: 1 }], out: 'g1', led: [6.8, 1],
				rule: function (A, B) { return A & (1 - B); }, at: { A: 0, B: 2 } },
			{ id: 4, inputs: ['A', 'B', 'C'], nodes: [{ id: 'g1', slot: true, in: ['A', 'B'], x: 3, y: 1 }, { id: 'g2', slot: true, in: ['g1', 'C'], x: 6, y: 2 }], out: 'g2', led: [8.4, 2],
				rule: function (A, B, C) { return (A | B) & C; }, at: { A: 0, B: 2, C: 4 } },
			{ id: 5, inputs: ['A', 'B', 'C'], nodes: [{ id: 'g1', slot: true, in: ['A', 'B'], x: 3, y: 1 }, { id: 'n1', type: 'NOT', in: ['C'], x: 3.2, y: 4 }, { id: 'g2', slot: true, in: ['g1', 'n1'], x: 6, y: 2.5 }], out: 'g2', led: [8.4, 2.5],
				rule: function (A, B, C) { return A & B & (1 - C); }, at: { A: 0, B: 2, C: 4 } },
			{ id: 6, inputs: ['A', 'B', 'C'], nodes: [{ id: 'g1', slot: true, in: ['A', 'B'], x: 3, y: 1 }, { id: 'g2', slot: true, in: ['g1', 'C'], x: 6, y: 2 }], out: 'g2', led: [8.4, 2],
				rule: function (A, B, C) { return A ^ B ^ C; }, at: { A: 0, B: 2, C: 4 } },
			{ id: 7, inputs: ['A', 'B', 'C'], nodes: [
				{ id: 'g1', slot: true, in: ['A', 'B'], x: 3, y: 0.5 }, { id: 'g2', slot: true, in: ['A', 'B'], x: 3, y: 3 },
				{ id: 'g3', slot: true, in: ['g2', 'C'], x: 6, y: 4 }, { id: 'g4', slot: true, in: ['g1', 'g3'], x: 9, y: 2.25 }], out: 'g4', led: [11.4, 2.25],
				rule: function (A, B, C) { return (A & B) | (A & C) | (B & C); }, at: { A: 0, B: 2, C: 5 } }
		];

		function slots(L) { return L.nodes.filter(function (n) { return n.slot; }).map(function (n) { return n.id; }); }

		/* Every signal for one input combination; null where an empty slot feeds it. */
		function evaluate(L, choice, inputs) {
			var v = {};
			L.inputs.forEach(function (k, i) { v[k] = inputs[i]; });
			L.nodes.forEach(function (n) {
				var t = n.slot ? choice[n.id] : n.type, a = v[n.in[0]], b = v[n.in[1]];
				v[n.id] = !t || a === null || (n.in.length > 1 && b === null) ? null : FN[t](a, b);
			});
			return v;
		}
		function rows(L) {
			var n = L.inputs.length, out = [];
			for (var r = 0; r < (1 << n); r++) {
				var bits = []; for (var i = 0; i < n; i++) bits.push((r >> (n - 1 - i)) & 1);
				out.push(bits);
			}
			return out;
		}
		function check(L, choice) {
			var match = 0, all = rows(L);
			var table = all.map(function (bits) {
				var want = L.rule.apply(null, bits), got = evaluate(L, choice, bits)[L.out];
				if (got === want) match++;
				return { bits: bits, want: want, got: got };
			});
			return { table: table, match: match, total: all.length, solved: match === all.length };
		}
		/* All the fillings that solve a level, by brute force: at most 5^4. */
		function solutions(L) {
			var ids = slots(L), found = [];
			(function walk(i, choice) {
				if (i === ids.length) { if (check(L, choice).solved) found.push(JSON.parse(JSON.stringify(choice))); return; }
				CHOICES.forEach(function (c) { choice[ids[i]] = c; walk(i + 1, choice); });
				delete choice[ids[i]];
			})(0, {});
			return found;
		}

		return { FN: FN, CHOICES: CHOICES, LEVELS: LEVELS, slots: slots, evaluate: evaluate, rows: rows, check: check, solutions: solutions };
	})();

	if (typeof document === 'undefined') { module.exports = Core; return; }
	var G = root.JKGames;
	var section = document.getElementById('logic');
	if (!G || !section) return;

	var S = {
		en: { stories: ['Two-hand safety press. The press may only cycle while both buttons, A and B, are held, so neither hand can be under it.',
				'Stairwell light. There is a switch at each end of the stairs, A and B, and flipping either one must change the light.',
				'Seat-belt chime. A is on when the driver is seated, B when the belt is buckled. The chime sounds when the driver is seated and the belt is not buckled.',
				'Conveyor. Either start button, A or B, runs the belt, but only while the safety guard C is closed.',
				'Drone arming. The motors arm when the throttle is at zero (A) and the arm switch is on (B), unless the battery warning C is on.',
				'Parity check. The LED lights when an odd number of the three switches is on: one, or all three.',
				'Two out of three. Three sensors vote and the LED follows the majority: it lights when at least two of A, B and C are on. Redundant flight computers settle disagreements this way.'],
			names: { AND: 'AND', OR: 'OR', XOR: 'XOR', NAND: 'NAND', NOR: 'NOR', NOT: 'NOT' },
			level: 'Level {n}', solvedTag: 'solved', unsolvedTag: 'not solved yet', gate: 'Gate {n}', choose: 'Choose…',
			want: 'Rule', got: 'Circuit', led: 'LED', on: 'on', off: 'off',
			match: '{m} of {n} cases right', solved: 'Solved: the LED lights exactly when it should.', ways: 'There are {n} different ways to wire this one.',
			aria: 'Logic circuit, level {n}. Switches {sw}. The LED is {led}.' },
		fr: { stories: ['Presse à commande bimanuelle. La presse ne doit descendre que si les deux boutons A et B sont maintenus, pour qu’aucune main ne soit dessous.',
				'Va-et-vient d’escalier. Un interrupteur en bas, A, un en haut, B : basculer l’un ou l’autre doit changer l’état de la lampe.',
				'Alerte de ceinture. A indique que le conducteur est assis, B que la ceinture est bouclée. Le signal sonne quand le conducteur est assis et que la ceinture n’est pas bouclée.',
				'Convoyeur. L’un ou l’autre bouton de marche, A ou B, fait avancer le tapis, mais seulement si le carter de protection C est fermé.',
				'Armement d’un drone. Les moteurs s’arment quand les gaz sont à zéro (A) et que l’interrupteur d’armement est actif (B), sauf si l’alerte batterie C est allumée.',
				'Contrôle de parité. La LED s’allume quand un nombre impair d’interrupteurs est actif : un seul, ou les trois.',
				'Deux sur trois. Trois capteurs votent et la LED suit la majorité : elle s’allume quand au moins deux de A, B et C sont actifs. C’est ainsi que des calculateurs de vol redondants tranchent leurs désaccords.'],
			names: { AND: 'ET', OR: 'OU', XOR: 'OU exclusif', NAND: 'NON-ET', NOR: 'NON-OU', NOT: 'NON' },
			level: 'Niveau {n}', solvedTag: 'résolu', unsolvedTag: 'pas encore résolu', gate: 'Porte {n}', choose: 'Choisir…',
			want: 'Règle', got: 'Circuit', led: 'LED', on: 'allumée', off: 'éteinte',
			match: '{m} cas justes sur {n}', solved: 'Résolu : la LED s’allume exactement quand il faut.', ways: 'Il y a {n} façons différentes de câbler celui-ci.',
			aria: 'Circuit logique, niveau {n}. Interrupteurs {sw}. La LED est {led}.' },
		zh: { stories: ['双手安全压力机。只有 A、B 两个按钮同时按住时，压力机才能动作，这样两只手都不会在它下面。',
				'楼梯灯。楼梯两头各有一个开关 A 和 B，拨动任意一个都要改变灯的状态。',
				'安全带提醒。A 表示驾驶员已就座，B 表示安全带已系好。驾驶员已就座而安全带未系好时，提示音响起。',
				'传送带。按下任意一个启动按钮 A 或 B 都能让传送带运行，但前提是防护罩 C 已关闭。',
				'无人机解锁。油门在零位（A）且解锁开关打开（B）时电机解锁，但电池报警 C 亮起时除外。',
				'奇偶校验。打开的开关数为奇数（一个或三个）时，LED 点亮。',
				'三取二。三个传感器投票，LED 听从多数：A、B、C 中至少两个为 1 时点亮。冗余飞控就是这样解决分歧的。'],
			names: { AND: '与', OR: '或', XOR: '异或', NAND: '与非', NOR: '或非', NOT: '非' },
			level: '第 {n} 关', solvedTag: '已完成', unsolvedTag: '未完成', gate: '门 {n}', choose: '请选择…',
			want: '规则', got: '电路', led: 'LED', on: '亮', off: '灭',
			match: '{n} 种情况中对了 {m} 种', solved: '完成：LED 恰好在该亮的时候亮。', ways: '这一关共有 {n} 种不同的接法。',
			aria: '逻辑电路，第 {n} 关。开关 {sw}。LED {led}。' }
	};
	function table() { return S[G.lang] || S.en; }
	function tr(k, v) { return G.t(S, k, v); }
	var SYMBOL = { AND: '&', OR: '≥1', XOR: '=1', NAND: '&', NOR: '≥1', NOT: '1' };
	var INVERTS = { NAND: 1, NOR: 1, NOT: 1 };

	var canvas = section.querySelector('canvas');
	var statusEl = section.querySelector('.game__status');
	var nameEl = section.querySelector('.game__name'), hintEl = section.querySelector('.game__hint');
	var switchBox = section.querySelector('.logic__switches'), slotBox = section.querySelector('.logic__slots');
	var thead = section.querySelector('.logic__table thead'), tbody = section.querySelector('.logic__table tbody');

	var GW = 1.6, GH = 2, NW = 1.2, NH = 1.4;      // gate and inverter boxes, in grid units
	var solved = G.store.get('logic:solved', Core.LEVELS.map(function () { return 0; }));
	var li = 0, L = Core.LEVELS[0], choice = {}, inputs = [], result = null, hits = [];
	// the canvas takes the shape of the circuit, within limits, so a small one is not lost in a tall box
	var stage = new G.Stage(canvas, { aspect: function (w) { var e = extents(); return Math.max(w < 560 ? 1.1 : 1.6, Math.min(3, (e.x1 - e.x0) / (e.y1 - e.y0))); }, maxH: 400 });
	var pal = G.palette(section);

	function setLevel(i) {
		li = i; L = Core.LEVELS[i];
		section.querySelectorAll('[data-level]').forEach(function (b, j) { b.setAttribute('aria-pressed', String(j === i)); });
		nameEl.textContent = tr('level', { n: L.id }) + '.';
		stage.fit();
		hintEl.textContent = table().stories[i];
		var saved = G.store.get('logic:choice:' + L.id, {});
		choice = {};
		Core.slots(L).forEach(function (id) { if (Core.CHOICES.indexOf(saved[id]) >= 0) choice[id] = saved[id]; });
		inputs = L.inputs.map(function () { return 0; });
		statusEl.textContent = '';
		controls(); update(true);
	}

	function controls() {
		switchBox.innerHTML = '';
		L.inputs.forEach(function (k, i) {
			var b = document.createElement('button');
			b.type = 'button'; b.className = 'game__chip logic__switch';
			b.addEventListener('click', function () { toggle(i); });
			switchBox.appendChild(b);
		});
		slotBox.innerHTML = '';
		Core.slots(L).forEach(function (id, i) {
			var l = document.createElement('label'); l.className = 'gears__pick logic__pick';
			var sp = document.createElement('span'); sp.textContent = tr('gate', { n: i + 1 }); l.appendChild(sp);
			var sel = document.createElement('select'); sel.setAttribute('data-slot', id);
			var none = document.createElement('option'); none.value = ''; none.textContent = tr('choose'); sel.appendChild(none);
			Core.CHOICES.forEach(function (c) {
				var o = document.createElement('option'); o.value = c;
				o.textContent = table().names[c] + ' (' + SYMBOL[c] + (INVERTS[c] ? ', ○' : '') + ')';
				sel.appendChild(o);
			});
			sel.value = choice[id] || '';
			sel.addEventListener('change', function () { setSlot(id, sel.value); });
			l.appendChild(sel);
			slotBox.appendChild(l);
		});
	}
	function toggle(i) { inputs[i] = 1 - inputs[i]; update(true); }
	function setSlot(id, v) {
		if (v) choice[id] = v; else delete choice[id];
		var sel = slotBox.querySelector('[data-slot="' + id + '"]');
		if (sel && sel.value !== (v || '')) sel.value = v || '';
		update(false);
	}

	function update(quiet) {
		result = Core.check(L, choice);
		G.store.set('logic:choice:' + L.id, choice);
		if (result.solved && !solved[li]) { solved[li] = 1; G.store.set('logic:solved', solved); }
		switchBox.querySelectorAll('button').forEach(function (b, i) {
			b.textContent = L.inputs[i] + ' = ' + inputs[i];
			b.setAttribute('aria-pressed', String(!!inputs[i]));
		});
		paintLevels(); truth(); draw();
		section.classList.toggle('is-right', result.solved);
		var msg = result.solved ? tr('solved') : tr('match', { m: result.match, n: result.total });
		if (result.solved) { var ways = Core.solutions(L).length; if (ways > 1) msg += ' ' + tr('ways', { n: ways }); }
		if (!quiet || result.solved) statusEl.textContent = msg;
		var v = Core.evaluate(L, choice, inputs)[L.out];
		canvas.setAttribute('aria-label', tr('aria', { n: L.id, sw: L.inputs.map(function (k, i) { return k + ' = ' + inputs[i]; }).join(', '), led: v ? tr('on') : tr('off') }));
	}

	function paintLevels() {
		section.querySelectorAll('[data-level]').forEach(function (b, j) {
			b.querySelector('.logic__done').textContent = solved[j] ? '✓' : '';
			b.setAttribute('aria-label', tr('level', { n: j + 1 }) + (G.lang === 'zh' ? '，' : ', ') + (solved[j] ? tr('solvedTag') : tr('unsolvedTag')));
		});
	}

	function truth() {
		thead.innerHTML = '';
		var hr = document.createElement('tr');
		L.inputs.concat([tr('want'), tr('got'), '']).forEach(function (h) { var th = document.createElement('th'); th.textContent = h; hr.appendChild(th); });
		thead.appendChild(hr);
		tbody.innerHTML = '';
		result.table.forEach(function (r) {
			var row = document.createElement('tr');
			if (r.bits.join('') === inputs.join('')) row.className = 'is-now';
			r.bits.concat([r.want, r.got === null ? '?' : r.got]).forEach(function (c) { var td = document.createElement('td'); td.textContent = c; row.appendChild(td); });
			var ok = document.createElement('td');
			ok.textContent = r.got === null ? '' : r.got === r.want ? '✓' : '✗';
			if (r.got !== null) ok.className = r.got === r.want ? 'is-ok' : 'is-bad';
			row.appendChild(ok);
			tbody.appendChild(row);
		});
	}

	// ---------------------------------------------------------------- drawing
	function box(n) { return n.slot || n.type !== 'NOT' ? { w: GW, h: GH } : { w: NW, h: NH }; }
	function pinIn(n, k) { var b = box(n); return [n.x, n.in.length === 1 ? n.y : n.y + (k ? 0.5 : -0.5)]; }
	function pinOut(id) {
		if (L.at[id] != null) return [0.9, L.at[id]];
		var n = node(id), b = box(n);
		return [n.x + b.w + (inverts(n) ? 0.36 : 0), n.y];
	}
	function node(id) { for (var i = 0; i < L.nodes.length; i++) if (L.nodes[i].id === id) return L.nodes[i]; return null; }
	function typeOf(n) { return n.slot ? choice[n.id] : n.type; }
	function inverts(n) { return !!INVERTS[typeOf(n)]; }

	/* Wires leave their source horizontally, turn once in the gap before the gate
	 * (the upper pin closer to the gate, so the two never cross), and enter flat. */
	function wires() {
		var out = [];
		L.nodes.forEach(function (n) {
			n.in.forEach(function (src, k) {
				var a = pinOut(src), b = pinIn(n, k), cx = b[0] - (n.in.length === 1 ? 0.5 : k ? 0.95 : 0.5);
				out.push({ src: src, pts: a[1] === b[1] ? [a, b] : [a, [cx, a[1]], [cx, b[1]], b] });
			});
		});
		out.push({ src: L.out, pts: [pinOut(L.out), [L.led[0] - 0.55, L.led[1]]] });
		return out;
	}

	function draw() {
		var ctx = stage.ctx, w = stage.w, h = stage.h;
		var sig = Core.evaluate(L, choice, inputs);
		var e = extents(), minX = e.x0, maxX = e.x1, minY = e.y0, maxY = e.y1;
		var s = Math.min((w - 24) / (maxX - minX), h / (maxY - minY), 80);
		var ox = (w - (maxX - minX) * s) / 2 - minX * s, oy = (h - (maxY - minY) * s) / 2 - minY * s;
		function X(x) { return ox + x * s; } function Y(y) { return oy + y * s; }
		var fs = Math.max(11, Math.min(16, s * 0.36));
		hits = [];

		ctx.fillStyle = pal.panel; ctx.fillRect(0, 0, w, h);
		ctx.lineJoin = 'round'; ctx.lineCap = 'round';

		// wires under everything, with a dot wherever one branches off another
		var ws = wires(), turns = {};
		ws.forEach(function (wr) {
			var v = sig[wr.src];
			ctx.strokeStyle = v === 1 ? pal.accent : pal.muted;
			ctx.lineWidth = v === 1 ? Math.max(2.5, s * 0.075) : Math.max(1.5, s * 0.045);
			ctx.setLineDash(v === null ? [4, 4] : []);
			ctx.beginPath();
			wr.pts.forEach(function (p, i) { if (i) ctx.lineTo(X(p[0]), Y(p[1])); else ctx.moveTo(X(p[0]), Y(p[1])); });
			ctx.stroke();
			if (wr.pts.length > 2) (turns[wr.src] = turns[wr.src] || []).push(wr.pts[1]);
		});
		ctx.setLineDash([]);
		Object.keys(turns).forEach(function (src) {
			var t = turns[src], far = Math.max.apply(null, t.map(function (p) { return p[0]; }));
			var direct = ws.some(function (wr) { return wr.src === src && wr.pts.length === 2 && wr.pts[1][0] > far; });
			t.forEach(function (p) {
				if (p[0] === far && !direct && t.filter(function (q) { return q[0] === far; }).length === 1) return;
				ctx.fillStyle = sig[src] === 1 ? pal.accent : pal.muted;
				ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), Math.max(2.5, s * 0.08), 0, 2 * Math.PI); ctx.fill();
			});
		});

		// switches
		L.inputs.forEach(function (k, i) {
			var y = L.at[k], on = inputs[i] === 1, r = 0.42 * s;
			var x0 = X(0) - r * 1.2, x1 = X(0.9) - r * 0.2;
			ctx.fillStyle = on ? pal.accent : pal.bg;
			ctx.strokeStyle = on ? pal.accent : pal.muted; ctx.lineWidth = 1.5;
			G.roundRect(ctx, x0 - r * 0.2, Y(y) - r * 0.75, (x1 - x0) + r * 0.4, r * 1.5, r * 0.75); ctx.fill(); ctx.stroke();
			ctx.fillStyle = on ? pal.panel : pal.muted;
			ctx.beginPath(); ctx.arc(on ? x1 - r * 0.35 : x0 + r * 0.35, Y(y), r * 0.52, 0, 2 * Math.PI); ctx.fill();
			ctx.fillStyle = pal.ink; ctx.font = G.font(fs, 700); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
			ctx.fillText(k, x0 - r * 0.45, Y(y));
			hits.push({ x0: x0 - r * 1.4, y0: Y(y) - r, x1: x1 + r * 0.3, y1: Y(y) + r, act: function () { toggle(i); } });
		});

		// gates
		var slotNo = 0;
		L.nodes.forEach(function (n) {
			var b = box(n), t = typeOf(n), x = X(n.x), y = Y(n.y - b.h / 2), bw = b.w * s, bh = b.h * s;
			if (n.slot) slotNo++;
			ctx.fillStyle = pal.bg; ctx.fillRect(x, y, bw, bh);
			ctx.strokeStyle = n.slot && !t ? pal.warn : pal.ink; ctx.lineWidth = 2;
			ctx.setLineDash(n.slot && !t ? [5, 4] : []);
			ctx.strokeRect(x, y, bw, bh); ctx.setLineDash([]);
			ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.fillStyle = n.slot && !t ? pal.warn : pal.ink;
			ctx.font = G.font(fs * (t ? 1.15 : 1.3), 700);
			ctx.fillText(t ? SYMBOL[t] : '?', x + bw / 2, y + bh * 0.42);
			if (inverts(n)) {
				ctx.beginPath(); ctx.arc(x + bw + 0.18 * s, Y(n.y), 0.18 * s, 0, 2 * Math.PI);
				ctx.fillStyle = pal.bg; ctx.fill(); ctx.strokeStyle = pal.ink; ctx.lineWidth = 2; ctx.stroke();
			}
			ctx.font = G.font(Math.max(10, fs * 0.72), 600); ctx.fillStyle = pal.muted;
			if (n.slot) ctx.fillText(tr('gate', { n: slotNo }), x + bw / 2, y + bh * 0.8);
			var label = t ? table().names[t] : '';
			if (label) { ctx.fillStyle = pal.muted; ctx.textBaseline = 'top'; ctx.fillText(label, x + bw / 2, y + bh + 0.12 * s); }
			if (n.slot) {
				var id = n.id;
				hits.push({ x0: x, y0: y, x1: x + bw, y1: y + bh, act: function () { cycle(id); } });
			}
		});

		// the LED
		var on = sig[L.out] === 1, lx = X(L.led[0]), ly = Y(L.led[1]), lr = 0.5 * s;
		if (on) {
			var glow = ctx.createRadialGradient(lx, ly, lr * 0.4, lx, ly, lr * 2.4);
			glow.addColorStop(0, pal.led); glow.addColorStop(1, 'rgba(0,0,0,0)');
			ctx.globalAlpha = 0.55; ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(lx, ly, lr * 2.4, 0, 2 * Math.PI); ctx.fill(); ctx.globalAlpha = 1;
		}
		ctx.beginPath(); ctx.arc(lx, ly, lr, 0, 2 * Math.PI);
		ctx.fillStyle = on ? pal.led : pal.bg; ctx.fill();
		ctx.strokeStyle = on ? pal.ledEdge : pal.muted; ctx.lineWidth = 2; ctx.stroke();
		ctx.fillStyle = pal.muted; ctx.font = G.font(fs * 0.8, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
		ctx.fillText(tr('led'), lx, ly + lr + 0.2 * s);
	}

	/* The circuit's extent in grid units: the switches and their letters reach
	 * about 1.3 units left of x = 0, the gate names a little below the boxes. */
	function extents() {
		var ys = L.inputs.map(function (k) { return L.at[k]; });
		L.nodes.forEach(function (n) { ys.push(n.y - box(n).h / 2, n.y + box(n).h / 2); });
		return { x0: -1.3, x1: L.led[0] + 1.1, y0: Math.min.apply(null, ys) - 1.1, y1: Math.max.apply(null, ys) + 1.1 };
	}

	function cycle(id) {
		var i = Core.CHOICES.indexOf(choice[id]);
		setSlot(id, Core.CHOICES[(i + 1) % Core.CHOICES.length]);
	}

	canvas.addEventListener('click', function (e) {
		var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
		for (var i = 0; i < hits.length; i++) {
			var hb = hits[i];
			if (x >= hb.x0 && x <= hb.x1 && y >= hb.y0 && y <= hb.y1) { hb.act(); return; }
		}
	});
	canvas.addEventListener('mousemove', function (e) {
		var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
		canvas.style.cursor = hits.some(function (hb) { return x >= hb.x0 && x <= hb.x1 && y >= hb.y0 && y <= hb.y1; }) ? 'pointer' : '';
	});
	section.querySelectorAll('[data-level]').forEach(function (b, j) { b.addEventListener('click', function () { setLevel(j); }); });
	section.querySelector('[data-act="reset"]').addEventListener('click', function () {
		choice = {}; controls(); update(true); statusEl.textContent = '';
	});
	stage.onResize = draw;
	G.onScheme(function () { pal = G.palette(section); draw(); });

	setLevel(0);
	G.games.logic = { Core: Core, get state() { return { level: L.id, choice: JSON.parse(JSON.stringify(choice)), inputs: inputs.slice(), solved: result.solved, done: solved.slice() }; } };
})(typeof window !== 'undefined' ? window : this);
