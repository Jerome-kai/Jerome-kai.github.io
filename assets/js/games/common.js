/* Shared helpers for the mini games on games.html. No dependencies.
 *
 * Each game reads its colours from CSS custom properties on its .game element,
 * so the light and dark themes are defined in one place (games.css) and a
 * change of system theme is picked up without reloading.
 */
(function (root) {
	'use strict';

	var htmlLang = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
	var lang = htmlLang.indexOf('zh') === 0 ? 'zh' : htmlLang.indexOf('fr') === 0 ? 'fr' : 'en';

	/* t(dict, key, vars): look a string up in {en:{}, fr:{}, zh:{}} and fill {placeholders}. */
	function t(dict, key, vars) {
		var table = dict[lang] || dict.en;
		var s = table[key] != null ? table[key] : dict.en[key];
		if (s == null) return key;
		if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
		return s;
	}

	/* Numbers are shown with the reader's decimal separator: a comma in French. */
	function num(x, digits) {
		var s = Number(x).toFixed(digits);
		return lang === 'fr' ? s.replace('.', ',') : s;
	}

	/* Accepts "23.4", "23,4", " 23.40 mm " and the like; NaN for anything else. */
	function parseNum(str) {
		if (typeof str !== 'string') return NaN;
		var s = str.trim().toLowerCase().replace(/mm$/, '').replace(/\s+/g, '').replace(',', '.');
		if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
		return parseFloat(s);
	}

	var VARS = [['bg', 'bg'], ['panel', 'panel'], ['ink', 'ink'], ['muted', 'muted'], ['grid', 'grid'],
		['accent', 'accent'], ['good', 'good'], ['bad', 'bad'], ['warn', 'warn'], ['sky1', 'sky1'],
		['sky2', 'sky2'], ['ground', 'ground'], ['hill', 'hill'], ['metal1', 'metal1'], ['metal2', 'metal2'],
		['metalInk', 'metal-ink'], ['slider1', 'slider1'], ['slider2', 'slider2'], ['overlay', 'overlay'],
		['gearIn', 'gear-in'], ['gearOut', 'gear-out'], ['gearDone', 'gear-done'], ['led', 'led'], ['ledEdge', 'led-edge']];

	function palette(el) {
		var cs = getComputedStyle(el), p = {};
		VARS.forEach(function (v) { p[v[0]] = cs.getPropertyValue('--g-' + v[1]).trim() || '#888'; });
		return p;
	}

	var fontFamily = (getComputedStyle(document.body).fontFamily || 'sans-serif') +
		', "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif';
	function font(px, weight) { return (weight || 400) + ' ' + px + 'px ' + fontFamily; }

	/* A canvas that keeps itself sized to its container at the device pixel ratio.
	 * opts.aspect: width / height. opts.zoom(): horizontal multiplier (caliper).
	 * opts.minH / opts.maxH clamp the height in CSS pixels. */
	function Stage(canvas, opts) {
		var self = this;
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.opts = opts;
		this.w = 0; this.h = 0;
		this.onResize = null;
		var box = canvas.parentElement;
		function fit() {
			var base = box.clientWidth || 300;
			var zoom = opts.zoom ? opts.zoom() : 1;
			var aspect = typeof opts.aspect === 'function' ? opts.aspect(base) : opts.aspect;
			var w = Math.round(base * zoom);
			var h = Math.round(base / aspect);
			if (opts.minH) h = Math.max(opts.minH, h);
			if (opts.maxH) h = Math.min(opts.maxH, h);
			var dpr = Math.min(window.devicePixelRatio || 1, 3);
			if (w === self.w && h === self.h && dpr === self.dpr) return;
			self.w = w; self.h = h; self.dpr = dpr;
			canvas.style.width = w + 'px';
			canvas.style.height = h + 'px';
			canvas.width = Math.round(w * dpr);
			canvas.height = Math.round(h * dpr);
			self.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			if (self.onResize) self.onResize();
		}
		this.fit = fit;
		if (window.ResizeObserver) new ResizeObserver(fit).observe(box);
		else window.addEventListener('resize', fit);
		fit();
	}

	/* Best scores live in this browser only. Storage can be unavailable (private
	 * windows, blocked site data), in which case the games simply forget. */
	var store = {
		get: function (k, d) {
			try { var v = localStorage.getItem('jkw-games:' + k); return v == null ? d : JSON.parse(v); }
			catch (e) { return d; }
		},
		set: function (k, v) {
			try { localStorage.setItem('jkw-games:' + k, JSON.stringify(v)); } catch (e) { /* not stored */ }
		}
	};

	/* cb(visible) when the element scrolls in or out of view or the tab is hidden. */
	function watchVisible(el, cb) {
		var inView = true;
		function report() { cb(inView && !document.hidden); }
		if (window.IntersectionObserver) {
			new IntersectionObserver(function (entries) {
				inView = entries[entries.length - 1].isIntersecting;
				report();
			}, { threshold: 0.15 }).observe(el);
		}
		document.addEventListener('visibilitychange', report);
	}

	function onScheme(cb) {
		if (!window.matchMedia) return;
		var mq = window.matchMedia('(prefers-color-scheme: light)');
		if (mq.addEventListener) mq.addEventListener('change', cb); else if (mq.addListener) mq.addListener(cb);
	}

	function roundRect(ctx, x, y, w, h, r) {
		r = Math.min(r, w / 2, h / 2);
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.arcTo(x + w, y, x + w, y + h, r);
		ctx.arcTo(x + w, y + h, x, y + h, r);
		ctx.arcTo(x, y + h, x, y, r);
		ctx.arcTo(x, y, x + w, y, r);
		ctx.closePath();
	}

	/* Centre-of-canvas message panel, one or more lines, the first one larger. */
	function banner(ctx, pal, w, h, lines) {
		var size = Math.max(15, Math.min(26, w / 26));
		ctx.save();
		ctx.font = font(size, 600);
		var widths = lines.map(function (l, i) { ctx.font = font(i ? size * 0.68 : size, i ? 400 : 600); return ctx.measureText(l).width; });
		var bw = Math.min(w - 24, Math.max.apply(null, widths) + size * 2);
		var lh = size * 1.25, bh = lh * 0.6 + lines.length * lh * 0.9 + size * 0.6;
		var bx = (w - bw) / 2, by = (h - bh) / 2;
		ctx.fillStyle = pal.overlay;
		roundRect(ctx, bx, by, bw, bh, 8); ctx.fill();
		ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		lines.forEach(function (l, i) {
			ctx.font = font(i ? size * 0.68 : size, i ? 400 : 600);
			ctx.fillStyle = i ? pal.muted : pal.ink;
			ctx.fillText(l, w / 2, by + size * 0.9 + i * lh * 0.9, bw - size);
		});
		ctx.restore();
	}

	/* n of 3 stars into el: earned ones filled, the rest outlined (see games.css). */
	function stars(el, n) {
		el.textContent = '';
		var on = document.createElement('span'), off = document.createElement('span');
		on.className = 'on'; on.textContent = '★'.repeat(n);
		off.className = 'off'; off.textContent = '☆'.repeat(3 - n);
		el.appendChild(on); el.appendChild(off);
	}

	var reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

	root.JKGames = {
		lang: lang, t: t, num: num, parseNum: parseNum, palette: palette, font: font,
		Stage: Stage, store: store, watchVisible: watchVisible, onScheme: onScheme,
		roundRect: roundRect, banner: banner, stars: stars, reducedMotion: reducedMotion, games: {}
	};
})(window);
