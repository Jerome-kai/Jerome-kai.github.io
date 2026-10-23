/* Three Views: pick the orthographic view of a block from four drawings.
 *
 * A block is a stack of unit cubes on a small grid. Its views are computed the
 * way a draughtsman would draw them: a visible line wherever the surface seen
 * from that side changes depth, and a dashed hidden line wherever an edge of
 * the block lies behind that surface. The wrong answers are the mistakes people
 * actually make: another view, the right view mirrored, front and back swapped,
 * or the view of a block that differs by one cube.
 */
(function (root) {
	'use strict';

	var Core = (function () {
		/* o = { X, Y, Z, h: [y][x] } with y = 0 the front row: a height map, so
		 * every column stands on the ground and nothing hangs in the air. */
		function occ(o, x, y, z) {
			return x >= 0 && y >= 0 && z >= 0 && x < o.X && y < o.Y && z < o.h[y][x];
		}

		/* Each view maps drawing coordinates (u right, v up, w away from the eye)
		 * to the block. The top view keeps the front at the bottom of the sheet,
		 * which is the same in first- and third-angle projection. */
		var VIEWS = {
			front: { dims: function (o) { return [o.X, o.Z, o.Y]; }, at: function (o, u, v, w) { return occ(o, u, w, v); } },
			top: { dims: function (o) { return [o.X, o.Y, o.Z]; }, at: function (o, u, v, w) { return occ(o, u, v, o.Z - 1 - w); } },
			right: { dims: function (o) { return [o.Y, o.Z, o.X]; }, at: function (o, u, v, w) { return occ(o, o.X - 1 - w, u, v); } },
			left: { dims: function (o) { return [o.Y, o.Z, o.X]; }, at: function (o, u, v, w) { return occ(o, w, o.Y - 1 - u, v); } }
		};
		var NAMES = ['front', 'top', 'right', 'left'];

		/* The drawing: unit segments, kind 1 visible and 2 hidden. */
		function view(o, name) {
			var V = VIEWS[name], d = V.dims(o), U = d[0], H = d[1], W = d[2];
			function at(u, v, w) { return u >= 0 && v >= 0 && w >= 0 && u < U && v < H && w < W && V.at(o, u, v, w) ? 1 : 0; }
			function near(u, v) { for (var w = 0; w < W; w++) if (at(u, v, w)) return w; return Infinity; }
			/* An edge runs along the boundary between two cells of the drawing at
			 * depth d if the four cubes around that line do not form a flat face. */
			function edge(u0, v0, u1, v1) {
				for (var w = 0; w <= W; w++) {
					var a = at(u0, v0, w - 1), b = at(u1, v1, w - 1), c = at(u0, v0, w), e = at(u1, v1, w);
					var n = a + b + c + e;
					if (n === 1 || n === 3 || (n === 2 && a === e)) return true;
				}
				return false;
			}
			var segs = [];
			function add(u0, v0, u1, v1, x0, y0, x1, y1) {
				var k = near(u0, v0) !== near(u1, v1) ? 1 : edge(u0, v0, u1, v1) ? 2 : 0;
				if (k) segs.push({ x0: x0, y0: y0, x1: x1, y1: y1, k: k });
			}
			for (var i = 0; i <= U; i++) for (var v = 0; v < H; v++) add(i - 1, v, i, v, i, v, i, v + 1);
			for (var j = 0; j <= H; j++) for (var u = 0; u < U; u++) add(u, j - 1, u, j, u, j, u + 1, j);
			return { U: U, V: H, segs: segs };
		}

		function key(dr) {
			return dr.U + 'x' + dr.V + ':' + dr.segs.map(function (s) { return s.k + '@' + s.x0 + ',' + s.y0 + ',' + s.x1 + ',' + s.y1; }).sort().join(' ');
		}
		function mirror(dr) {
			return { U: dr.U, V: dr.V, segs: dr.segs.map(function (s) { return { x0: dr.U - s.x1, y0: s.y0, x1: dr.U - s.x0, y1: s.y1, k: s.k }; }) };
		}
		function flip(dr) {
			return { U: dr.U, V: dr.V, segs: dr.segs.map(function (s) { return { x0: s.x0, y0: dr.V - s.y1, x1: s.x1, y1: dr.V - s.y0, k: s.k }; }) };
		}

		/* Every floor cell and column top must be visible in the pictorial, or the
		 * player could not know what is behind; the bounding box must be tight. */
		function readable(o) {
			var used = { x0: false, x1: false, y0: false, y1: false, z: false }, cubes = 0, distinct = {};
			for (var y = 0; y < o.Y; y++) for (var x = 0; x < o.X; x++) {
				var hh = o.h[y][x]; cubes += hh; distinct[hh] = 1;
				if (hh) { if (x === 0) used.x0 = true; if (x === o.X - 1) used.x1 = true; if (y === 0) used.y0 = true; if (y === o.Y - 1) used.y1 = true; if (hh === o.Z) used.z = true; }
				for (var t = 0.02; t < o.X + o.Y + o.Z; t += 0.05) {
					if (occ(o, Math.floor(x + 0.5 + t), Math.floor(y + 0.5 - t), Math.floor(hh + t))) return false;
				}
			}
			if (!(used.x0 && used.x1 && used.y0 && used.y1 && used.z)) return false;
			if (Object.keys(distinct).length < 3) return false;          // at least two heights and a gap, or three heights
			return connected(o) && cubes >= o.X * o.Y * 0.6;
		}
		function connected(o) {
			var seen = {}, start = null, count = 0, total = 0;
			for (var y = 0; y < o.Y; y++) for (var x = 0; x < o.X; x++) if (o.h[y][x]) { total++; if (!start) start = [x, y]; }
			var stack = [start];
			while (stack.length) {
				var c = stack.pop(), k = c[0] + ',' + c[1];
				if (seen[k] || c[0] < 0 || c[1] < 0 || c[0] >= o.X || c[1] >= o.Y || !o.h[c[1]][c[0]]) continue;
				seen[k] = 1; count++;
				stack.push([c[0] + 1, c[1]], [c[0] - 1, c[1]], [c[0], c[1] + 1], [c[0], c[1] - 1]);
			}
			return count === total;
		}

		var TIERS = [
			{ X: 3, Y: 2, Z: 2, ask: ['front', 'top'] },
			{ X: 3, Y: 3, Z: 3, ask: ['front', 'top', 'right'] },
			{ X: 4, Y: 3, Z: 3, ask: ['front', 'top', 'right', 'left'] }
		];
		var ROUND = 8;
		function tierOf(i) { return TIERS[i < 2 ? 0 : i < 5 ? 1 : 2]; }

		function block(rand, T) {
			for (;;) {
				var o = { X: T.X, Y: T.Y, Z: T.Z, h: [] };
				for (var y = 0; y < T.Y; y++) { o.h.push([]); for (var x = 0; x < T.X; x++) o.h[y].push(Math.floor(rand() * (T.Z + 1))); }
				if (readable(o)) return o;
			}
		}

		/* A question: the block, the view asked for, and four drawings in random
		 * order, each tagged with why it is right or wrong. */
		function question(rand, i, avoid) {
			var T = tierOf(i);
			for (;;) {
				var o = block(rand, T), ask = T.ask[Math.floor(rand() * T.ask.length)];
				if (avoid && avoid === ask + JSON.stringify(o.h)) continue;
				var right = view(o, ask), seen = {}, pool = { other: [], twist: [], near: [] };
				seen[key(right)] = 1;
				function offer(kind, dr, why) { var k = key(dr); if (!seen[k]) { seen[k] = 1; pool[kind].push({ d: dr, why: why }); } }
				NAMES.forEach(function (n) { if (n !== ask && (T.ask.indexOf(n) >= 0 || n === 'left' || n === 'right')) offer('other', view(o, n), { k: 'view', v: n }); });
				offer('twist', mirror(right), { k: 'mirror' });
				if (ask === 'top') offer('twist', flip(right), { k: 'flip' });
				for (var y = 0; y < o.Y; y++) for (var x = 0; x < o.X; x++) [-1, 1].forEach(function (dz) {
					var h2 = o.h[y][x] + dz;
					if (h2 < 0 || h2 > o.Z) return;
					var o2 = { X: o.X, Y: o.Y, Z: o.Z, h: o.h.map(function (r) { return r.slice(); }) };
					o2.h[y][x] = h2;
					if (o2.h.some(function (r) { return r.some(function (c) { return c; }); }) && connected(o2)) offer('near', view(o2, ask), { k: 'near' });
				});
				if (!pool.other.length || !pool.twist.length || !pool.near.length) continue;
				var pick = function (a) { return a.splice(Math.floor(rand() * a.length), 1)[0]; };
				var opts = [{ d: right, why: { k: 'right' } }, pick(pool.other), pick(pool.twist), pick(pool.near)];
				for (var s = opts.length - 1; s > 0; s--) { var r = Math.floor(rand() * (s + 1)), tmp = opts[s]; opts[s] = opts[r]; opts[r] = tmp; }
				var answer = 0;
				opts.forEach(function (op, k) { if (op.why.k === 'right') answer = k; });
				return { o: o, ask: ask, options: opts, answer: answer, id: ask + JSON.stringify(o.h) };
			}
		}

		return { occ: occ, VIEWS: VIEWS, NAMES: NAMES, TIERS: TIERS, ROUND: ROUND, tierOf: tierOf,
			view: view, key: key, mirror: mirror, flip: flip, readable: readable, connected: connected,
			block: block, question: question };
	})();

	if (typeof document === 'undefined') { module.exports = Core; return; }
	var G = root.JKGames;
	var section = document.getElementById('views');
	if (!G || !section) return;

	var S = {
		en: { ask: { front: 'Which drawing is the front view?', top: 'Which drawing is the top view?', right: 'Which drawing is the view from the right?', left: 'Which drawing is the view from the left?' },
			arrow: { front: 'Front', top: 'Top', right: 'Right', left: 'Left' },
			viewName: { front: 'the front view', top: 'the top view', right: 'the view from the right', left: 'the view from the left' },
			option: 'Drawing {l}', progress: 'Question {i} of {n} · {c} correct',
			right: 'Correct: {l} is {v}.',
			wrong: { view: 'Not {l}: that is {v}. The answer is {a}.', mirror: 'Not {l}: it is mirrored left to right. The answer is {a}.',
				flip: 'Not {l}: it has the front and the back swapped. The answer is {a}.', near: 'Not {l}: it is the view of a block that differs by one cube. The answer is {a}.' },
			next: 'Next', finish: 'See the result', again: 'Play again',
			done: 'Round over: {c} out of {n}.', best: 'Best: {c} / {n}', newBest: 'New best!',
			pictorial: 'Pictorial view of a block of cubes. An arrow marks the front{extra}.', extra: ', a second arrow the direction of the view asked for' },
		fr: { ask: { front: 'Quel dessin est la vue de face ?', top: 'Quel dessin est la vue de dessus ?', right: 'Quel dessin est la vue de droite ?', left: 'Quel dessin est la vue de gauche ?' },
			arrow: { front: 'Face', top: 'Dessus', right: 'Droite', left: 'Gauche' },
			viewName: { front: 'la vue de face', top: 'la vue de dessus', right: 'la vue de droite', left: 'la vue de gauche' },
			option: 'Dessin {l}', progress: 'Question {i} sur {n} · {c} justes',
			right: 'Exact : {l} est {v}.',
			wrong: { view: 'Pas {l} : c’est {v}. La réponse est {a}.', mirror: 'Pas {l} : il est inversé de gauche à droite. La réponse est {a}.',
				flip: 'Pas {l} : l’avant et l’arrière sont inversés. La réponse est {a}.', near: 'Pas {l} : c’est la vue d’un bloc qui diffère d’un cube. La réponse est {a}.' },
			next: 'Suivant', finish: 'Voir le résultat', again: 'Rejouer',
			done: 'Manche terminée : {c} sur {n}.', best: 'Record : {c} / {n}', newBest: 'Nouveau record !',
			pictorial: 'Vue en perspective d’un bloc de cubes. Une flèche indique la face avant{extra}.', extra: ', une seconde la direction de la vue demandée' },
		zh: { ask: { front: '哪一个是主视图？', top: '哪一个是俯视图？', right: '哪一个是右视图（从右向左看）？', left: '哪一个是左视图（从左向右看）？' },
			arrow: { front: '前', top: '上', right: '右', left: '左' },
			viewName: { front: '主视图', top: '俯视图', right: '右视图', left: '左视图' },
			option: '图 {l}', progress: '第 {i}/{n} 题 · 答对 {c} 题',
			right: '正确：{l} 是{v}。',
			wrong: { view: '不是 {l}：那是{v}。答案是 {a}。', mirror: '不是 {l}：它左右反了。答案是 {a}。',
				flip: '不是 {l}：它前后反了。答案是 {a}。', near: '不是 {l}：那是另一个只差一个方块的物体的视图。答案是 {a}。' },
			next: '下一题', finish: '查看结果', again: '再玩一次',
			done: '本轮结束：{n} 题答对 {c} 题。', best: '最高：{c}/{n}', newBest: '新纪录！',
			pictorial: '由小方块组成的物体的轴测图。箭头标出正面{extra}。', extra: '，另一个箭头标出所问视图的观察方向' }
	};
	function table() { return S[G.lang] || S.en; }
	function tr(k, v) { return G.t(S, k, v); }
	function fill(s, v) { return s.replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; }); }
	var LETTERS = ['A', 'B', 'C', 'D'];

	var picture = section.querySelector('.views__picture');
	var askEl = section.querySelector('.views__ask');
	var choiceEls = section.querySelectorAll('.views__choice');
	var nextBtn = section.querySelector('[data-act="next"]');
	var metaEl = section.querySelector('.game__meta');
	var statusEl = section.querySelector('.game__status');

	var index = 0, correct = 0, q = null, answered = false, done = false, prevId = null;

	// ---------------------------------------------------------------- pictorial
	var C30 = Math.cos(Math.PI / 6);
	function P(x, y, z) { return [(x + y) * C30, (x - y) * 0.5 - z]; }
	function pts(a) { return a.map(function (p) { var s = P(p[0], p[1], p[2]); return s[0].toFixed(3) + ',' + s[1].toFixed(3); }).join(' '); }

	function pictorial(o, ask) {
		var cubes = [];
		for (var y = 0; y < o.Y; y++) for (var x = 0; x < o.X; x++) for (var z = 0; z < o.h[y][x]; z++) cubes.push([x, y, z]);
		// nearest last: the eye is out along +x, -y, +z
		cubes.sort(function (a, b) { return (a[0] - a[1] + a[2]) - (b[0] - b[1] + b[2]); });
		var faces = [
			{ cls: 'views__top', n: [0, 0, 1], q: function (x, y, z) { return [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]]; }, e: [[0, -1, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 0]] },
			{ cls: 'views__front', n: [0, -1, 0], q: function (x, y, z) { return [[x, y, z], [x + 1, y, z], [x + 1, y, z + 1], [x, y, z + 1]]; }, e: [[0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0]] },
			{ cls: 'views__side', n: [1, 0, 0], q: function (x, y, z) { return [[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]]; }, e: [[0, 0, -1], [0, 1, 0], [0, 0, 1], [0, -1, 0]] }
		];
		var out = [], creases = {};
		cubes.forEach(function (c) {
			faces.forEach(function (f) {
				if (Core.occ(o, c[0] + f.n[0], c[1] + f.n[1], c[2] + f.n[2])) return;
				var quad = f.q(c[0], c[1], c[2]);
				out.push('<polygon class="' + f.cls + '" points="' + pts(quad) + '"/>');
				// a side of this face is a crease unless the face runs on into a coplanar neighbour
				f.e.forEach(function (e, i) {
					var nb = [c[0] + e[0], c[1] + e[1], c[2] + e[2]];
					if (Core.occ(o, nb[0], nb[1], nb[2]) && !Core.occ(o, nb[0] + f.n[0], nb[1] + f.n[1], nb[2] + f.n[2])) return;
					var a = quad[i], b = quad[(i + 1) % 4];
					creases[[a, b].map(String).sort().join('|')] = [a, b];
				});
			});
		});
		out.push('<path class="views__edge" d="' + edgePaths(o, creases) + '"/>');
		// arrows: the front always, and the view asked for when it is another one
		var A = arrows(o);
		var labels = table().arrow;
		var marks = ask === 'front' ? [['front', 'views__arrow is-ask']] : [['front', 'views__arrow'], [ask, 'views__arrow is-ask']];
		var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
		function grow(p, r) { minX = Math.min(minX, p[0] - r); maxX = Math.max(maxX, p[0] + r); minY = Math.min(minY, p[1] - r); maxY = Math.max(maxY, p[1] + r); }
		for (var gx = 0; gx <= o.X; gx += o.X) for (var gy = 0; gy <= o.Y; gy += o.Y) for (var gz = 0; gz <= o.Z; gz += o.Z) grow(P(gx, gy, gz), 0.2);
		marks.forEach(function (m) {
			var a = P.apply(null, A[m[0]][0]), b = P.apply(null, A[m[0]][1]);
			var ang = Math.atan2(b[1] - a[1], b[0] - a[0]), hl = 0.42;
			var h1 = [b[0] - hl * Math.cos(ang - 0.45), b[1] - hl * Math.sin(ang - 0.45)], h2 = [b[0] - hl * Math.cos(ang + 0.45), b[1] - hl * Math.sin(ang + 0.45)];
			// the label sits beyond the tail, pushed out along the arrow
			var lx = a[0] - 0.55 * Math.cos(ang), ly = a[1] - 0.55 * Math.sin(ang);
			var anchor = Math.cos(ang) > 0.3 ? 'end' : Math.cos(ang) < -0.3 ? 'start' : 'middle';
			if (m[0] === 'top') ly -= 0.1;
			out.push('<g class="' + m[1] + '"><path d="M' + a[0].toFixed(3) + ' ' + a[1].toFixed(3) + 'L' + b[0].toFixed(3) + ' ' + b[1].toFixed(3) + '"/>' +
				'<polygon points="' + b[0].toFixed(3) + ',' + b[1].toFixed(3) + ' ' + h1[0].toFixed(3) + ',' + h1[1].toFixed(3) + ' ' + h2[0].toFixed(3) + ',' + h2[1].toFixed(3) + '"/>' +
				'<text x="' + lx.toFixed(3) + '" y="' + ly.toFixed(3) + '" text-anchor="' + anchor + '" dominant-baseline="' + (m[0] === 'top' ? 'auto' : 'middle') + '">' + labels[m[0]] + '</text></g>');
			// the label's extent, roughly: half a unit per character at this size
			var tw = labels[m[0]].length * (/[\u3000-\u9fff]/.test(labels[m[0]]) ? 0.5 : 0.3);
			var lx0 = anchor === 'end' ? lx - tw : anchor === 'start' ? lx : lx - tw / 2;
			grow([lx0, ly], 0.35); grow([lx0 + tw, ly], 0.35);
			grow(a, 0.3); grow(b, 0.3);
		});
		var pad = 0.3;
		var vb = [minX - pad, minY - pad, maxX - minX + 2 * pad, maxY - minY + 2 * pad].map(function (n) { return n.toFixed(3); }).join(' ');
		var extra = ask === 'front' ? '' : table().extra;
		return '<svg viewBox="' + vb + '" role="img" aria-label="' + fill(table().pictorial, { extra: extra }) + '">' + out.join('') + '</svg>';
	}

	/* Each arrow points at a real face on its side: the column of the front row,
	 * of the right or left end, or the tallest one, nearest the middle. The left
	 * side is out of sight, so that arrow stops where it no longer overlaps the
	 * block in the picture; the others end just short of the face they point at. */
	function arrows(o) {
		function pick(cells) {
			var best = null;
			cells.forEach(function (c) {
				var hh = o.h[c[1]][c[0]], d = Math.abs(c[0] + 0.5 - o.X / 2) + Math.abs(c[1] + 0.5 - o.Y / 2);
				if (hh && (!best || (c.tall ? hh > best.h || (hh === best.h && d < best.d) : d < best.d))) best = { x: c[0], y: c[1], h: hh, d: d };
			});
			return best;
		}
		function line(fixed, from) { var c = []; for (var i = 0; i < from; i++) c.push(fixed(i)); return c; }
		var f = pick(line(function (i) { return [i, 0]; }, o.X));
		var r = pick(line(function (i) { return [o.X - 1, i]; }, o.Y));
		var l = pick(line(function (i) { return [0, i]; }, o.Y));
		var all = []; for (var y = 0; y < o.Y; y++) for (var x = 0; x < o.X; x++) { var c = [x, y]; c.tall = true; all.push(c); }
		var tp = pick(all);
		function clear(p) {           // the line of sight through p meets no cube, either way
			for (var s = -(o.X + o.Y + o.Z + 2); s < o.X + o.Y + o.Z + 2; s += 0.05) {
				if (Core.occ(o, Math.floor(p[0] + s), Math.floor(p[1] - s), Math.floor(p[2] + s))) return false;
			}
			return true;
		}
		var lz = l.h / 2, ly = l.y + 0.5, d = 0.4;
		while (!clear([-d, ly, lz]) && d < 4) d += 0.1;
		return {
			front: [[f.x + 0.5, -2.6, f.h / 2], [f.x + 0.5, -0.35, f.h / 2]],
			right: [[o.X + 2.6, r.y + 0.5, r.h / 2], [o.X + 0.35, r.y + 0.5, r.h / 2]],
			left: [[-d - 2.2, ly, lz], [-d, ly, lz]],
			top: [[tp.x + 0.5, tp.y + 0.5, tp.h + 2.4], [tp.x + 0.5, tp.y + 0.5, tp.h + 0.3]]
		};
	}

	/* The creases that can be seen, as joined polylines. In an isometric view of
	 * unit cubes no other line crosses a unit edge between its ends, so an edge
	 * is wholly seen or wholly hidden: one ray from its midpoint towards the eye
	 * decides. Drawn after every face, so no face's anti-aliased rim nicks a line,
	 * and joined so corners meet without notches. */
	function edgePaths(o, creases) {
		var adj = {}, segs = [];
		Object.keys(creases).forEach(function (k) {
			var a = creases[k][0], b = creases[k][1];
			var m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
			for (var t = 0.02; t < o.X + o.Y + o.Z + 1; t += 0.05) {
				if (Core.occ(o, Math.floor(m[0] + t), Math.floor(m[1] - t), Math.floor(m[2] + t))) return;
			}
			var pa = P.apply(null, a), pb = P.apply(null, b);
			var ka = pa[0].toFixed(3) + ' ' + pa[1].toFixed(3), kb = pb[0].toFixed(3) + ' ' + pb[1].toFixed(3);
			if (ka === kb) return;
			var s = { a: ka, b: kb, used: false };
			segs.push(s);
			(adj[ka] = adj[ka] || []).push(s); (adj[kb] = adj[kb] || []).push(s);
		});
		function walk(from) {
			var d = 'M' + from, at = from;
			for (;;) {
				var s = (adj[at] || []).filter(function (q) { return !q.used; })[0];
				if (!s) return d;
				s.used = true; at = s.a === at ? s.b : s.a;
				d += at === from ? 'Z' : 'L' + at;        // a closed loop gets a join at its start too
			}
		}
		var d = '';
		// start at the loose ends first, so each open run is drawn in one piece
		Object.keys(adj).forEach(function (v) { if (adj[v].length % 2) while (adj[v].some(function (q) { return !q.used; })) d += walk(v); });
		segs.forEach(function (s) { if (!s.used) d += walk(s.a); });
		return d;
	}

	// ---------------------------------------------------------------- drawings
	function merge(segs) {          // join collinear unit segments of one kind, so dashes run on
		var by = {}, out = [];
		segs.forEach(function (s) {
			var vert = s.x0 === s.x1, k = s.k + (vert ? 'v' + s.x0 : 'h' + s.y0);
			(by[k] = by[k] || []).push(vert ? [s.y0, s.y1] : [s.x0, s.x1]);
		});
		Object.keys(by).forEach(function (k) {
			var kind = +k[0], vert = k[1] === 'v', at = +k.slice(2);
			var runs = by[k].sort(function (a, b) { return a[0] - b[0]; }), cur = null;
			runs.concat([[Infinity, Infinity]]).forEach(function (r) {
				if (cur && r[0] === cur[1]) { cur[1] = r[1]; return; }
				if (cur) out.push(vert ? { x0: at, y0: cur[0], x1: at, y1: cur[1], k: kind } : { x0: cur[0], y0: at, x1: cur[1], y1: at, k: kind });
				cur = r.slice();
			});
		});
		return out;
	}
	function drawing(dr, U, V) {
		var cell = 24, m = 6, ox = m + (U - dr.U) * cell / 2, oy = m + (V - dr.V) * cell / 2;
		var paths = { 1: '', 2: '' };
		merge(dr.segs).forEach(function (s) {
			// v runs up the sheet, SVG y runs down
			paths[s.k] += 'M' + (ox + s.x0 * cell) + ' ' + (oy + (dr.V - s.y0) * cell) + 'L' + (ox + s.x1 * cell) + ' ' + (oy + (dr.V - s.y1) * cell);
		});
		return '<svg viewBox="0 0 ' + (U * cell + 2 * m) + ' ' + (V * cell + 2 * m) + '" aria-hidden="true" focusable="false">' +
			(paths[2] ? '<path class="views__hidden" d="' + paths[2] + '"/>' : '') +
			'<path class="views__line" d="' + paths[1] + '"/></svg>';
	}

	// ---------------------------------------------------------------- play
	function ask() {
		q = Core.question(Math.random, index, prevId);
		prevId = q.id;
		answered = false;
		picture.innerHTML = pictorial(q.o, q.ask);
		askEl.textContent = table().ask[q.ask];
		var U = 0, V = 0;
		q.options.forEach(function (op) { U = Math.max(U, op.d.U); V = Math.max(V, op.d.V); });
		choiceEls.forEach(function (b, k) {
			b.classList.remove('is-right', 'is-wrong', 'is-answer');
			b.disabled = false;
			b.querySelector('.views__art').innerHTML = drawing(q.options[k].d, U, V);
		});
		nextBtn.hidden = true;
		statusEl.textContent = '';
		section.classList.remove('is-right', 'is-wrong');
		progress();
	}
	function progress() {
		metaEl.textContent = tr('progress', { i: Math.min(index + 1, Core.ROUND), n: Core.ROUND, c: correct });
	}
	function choose(k) {
		if (answered || done) return;
		answered = true;
		var ok = k === q.answer, why = q.options[k].why, t = table();
		if (ok) correct++;
		choiceEls.forEach(function (b, j) {
			b.disabled = true;
			if (j === q.answer) b.classList.add('is-answer');
		});
		choiceEls[k].classList.add(ok ? 'is-right' : 'is-wrong');
		var v = { l: LETTERS[k], a: LETTERS[q.answer], v: why.v ? t.viewName[why.v] : t.viewName[q.ask] };
		statusEl.textContent = ok ? fill(t.right, v) : fill(t.wrong[why.k], v);
		section.classList.toggle('is-right', ok); section.classList.toggle('is-wrong', !ok);
		index++;
		metaEl.textContent = tr('progress', { i: index, n: Core.ROUND, c: correct });
		nextBtn.textContent = index >= Core.ROUND ? tr('finish') : tr('next');
		nextBtn.hidden = false;
		nextBtn.focus({ preventScroll: true });
	}
	function next() {
		if (done) { restart(); return; }
		if (index >= Core.ROUND) { finish(); return; }
		ask();
		choiceEls[0].focus({ preventScroll: true });
	}
	function finish() {
		done = true;
		var b = G.store.get('views:best', null), isBest = !b || correct > b.c;
		if (isBest) G.store.set('views:best', { c: correct });
		statusEl.textContent = tr('done', { c: correct, n: Core.ROUND }) + ' ' + (isBest ? tr('newBest') : tr('best', { c: b.c, n: Core.ROUND }));
		section.classList.remove('is-right', 'is-wrong');
		nextBtn.textContent = tr('again');
	}
	function restart() {
		done = false; index = 0; correct = 0;
		ask();
		choiceEls[0].focus({ preventScroll: true });
	}

	choiceEls.forEach(function (b, k) {
		b.setAttribute('aria-label', tr('option', { l: LETTERS[k] }));
		b.addEventListener('click', function () { choose(k); });
	});
	nextBtn.addEventListener('click', next);
	section.addEventListener('keydown', function (e) {
		if (e.altKey || e.ctrlKey || e.metaKey) return;
		var k = 'abcd'.indexOf(e.key.toLowerCase());
		if (k < 0) k = '1234'.indexOf(e.key);
		if (k >= 0 && !answered && !done) { e.preventDefault(); choose(k); }
	});

	ask();
	G.games.views = { Core: Core, get state() { return { index: index, correct: correct, answered: answered, done: done, ask: q.ask, answer: q.answer, why: q.options.map(function (o) { return o.why.k; }) }; } };
})(typeof window !== 'undefined' ? window : this);
