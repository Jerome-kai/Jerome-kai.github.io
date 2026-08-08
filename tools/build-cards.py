# Single source for the business card: builds card.html / card-fr.html / card-zh.html
# and the print-ready PDFs. Every dimension is in mm so the on-screen preview and the
# printed sheet come out of the same CSS.
import os, pathlib, shutil, subprocess, tempfile, urllib.parse

REPO = pathlib.Path(__file__).resolve().parent.parent
HERE = pathlib.Path(tempfile.mkdtemp(prefix="cards-"))

SITE = "https://jerome-kai.github.io"
NAME_FR = "J&eacute;r&ocirc;me-Kai Wu"
NAME_EN = "Jerome-Kai Wu"
# same names without HTML entities, for comments and meta tags
PLAIN = {"en": "Jerome-Kai Wu", "fr": "Jérôme-Kai Wu", "zh": "吴锴"}
NAME_CN = "吴锴"
EMAIL = "wu.jerome.kai@gmail.com"
PHONE_FR = "+33 6 21 22 29 93"
PHONE_CN = "+86 134 7270 4378"
# The Chinese card carries both numbers, since the people it is handed to are the
# ones most likely to dial the +86 one. The English and French cards carry only
# the French number.
PHONES = {"en": [PHONE_FR], "fr": [PHONE_FR], "zh": [PHONE_CN, PHONE_FR]}
GITHUB = "github.com/Jerome-kai"
LINKEDIN_URL = "https://www.linkedin.com/in/jerome-kai-wu-137653386/"
LINKEDIN_TXT = "in/jerome-kai-wu-137653386"

LANGS = ("en", "fr", "zh")

L = {
    "en": {
        "html_lang": "en",
        "name": NAME_EN,
        "page": "card.html",
        "home": "index.html",
        "projects": "projects.html",
        "qr": "images/qr-projects.png",
        "title": "Business Card · Jerome-Kai Wu",
        "desc": "Digital business card of Jerome-Kai Wu, with contact details and a QR code to his engineering projects.",
        "h1": "Business Card",
        "role": "Mechanical Engineering Student · UTC",
        "qr_cap": "My projects",
        "front_label": "Front",
        "back_label": "Back",
        "print": "Print / Save as PDF",
        "back_site": "Back to site",
        "dl_head": "Download",
        "shop_head": "For a print shop",
        "shop_note": "Trim size 85.6 × 54 mm. The files below add 3 mm bleed and crop marks.",
        "pdf_all": "All 3 languages",
        "upper": True,
    },
    "fr": {
        "html_lang": "fr",
        "name": NAME_FR,
        "page": "card-fr.html",
        "home": "index-fr.html",
        "projects": "projects-fr.html",
        "qr": "images/qr-projects-fr.png",
        "title": "Carte de visite · Jérôme-Kai Wu",
        "desc": "Carte de visite numérique de Jérôme-Kai Wu, avec ses coordonnées et un QR code vers ses projets d'ingénierie.",
        "h1": "Carte de visite",
        "role": "Étudiant en ingénierie mécanique · UTC",
        "qr_cap": "Mes projets",
        "front_label": "Recto",
        "back_label": "Verso",
        "print": "Imprimer / Enregistrer en PDF",
        "back_site": "Retour au site",
        "dl_head": "Télécharger",
        "shop_head": "Pour un imprimeur",
        "shop_note": "Format coupé 85,6 × 54 mm. Les fichiers ci-dessous ajoutent 3 mm de fond perdu et les traits de coupe.",
        "pdf_all": "Les 3 langues",
        "upper": True,
    },
    "zh": {
        "html_lang": "zh-Hans",
        "name": NAME_CN,
        "page": "card-zh.html",
        "home": "index-zh.html",
        "projects": "projects-zh.html",
        "qr": "images/qr-projects-zh.png",
        "title": "名片 · 吴锴",
        "desc": "吴锴的电子名片，包含联系方式和通往工程项目页的二维码。",
        "h1": "名片",
        "role": "机械工程专业学生 · 贡比涅技术大学",
        "qr_cap": "我的项目",
        "front_label": "正面",
        "back_label": "背面",
        "print": "打印 / 保存为 PDF",
        "back_site": "返回网站",
        "dl_head": "下载",
        "shop_head": "交付印刷厂",
        "shop_note": "成品尺寸 85.6 × 54 毫米。下列文件已加 3 毫米出血和裁切线。",
        "pdf_all": "三语合一",
        "upper": True,
    },
}

# Chinese headings should not be letter-spaced/uppercased like the Latin ones.
L["zh"]["upper"] = False

SWITCH = [("en", "EN", "card.html"), ("fr", "FR", "card-fr.html"), ("zh", "中文", "card-zh.html")]
HREFLANG = {"en": "en", "fr": "fr", "zh": "zh-Hans"}


# ---------------------------------------------------------------- icons
def icon(color, body):
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" '
           f'stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{body}</svg>')
    return "data:image/svg+xml," + urllib.parse.quote(svg)


def icon_filled(color, body):
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="{color}">{body}</svg>')
    return "data:image/svg+xml," + urllib.parse.quote(svg)


PATH_MAIL = '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'
PATH_PHONE = ('<path d="M4.5 3h4l2 5-2.5 1.8a12.5 12.5 0 0 0 6.2 6.2L16 13.5l5 2v4a1.5 1.5 0 0 1-1.6 1.5'
              'C10.4 20.4 3.6 13.6 3 4.6A1.5 1.5 0 0 1 4.5 3z"/>')
PATH_GLOBE = '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z"/>'
PATH_GITHUB = ('<path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5'
               '-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 3 .8.1-.6.4-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7'
               '-.1-.2-.4-1.3.1-2.6 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.3.2 2.4.1 2.6.6.7 1 1.6 1 2.7'
               ' 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2z"/>')
PATH_LINKEDIN = ('<path d="M4 4h4v4H4zM4 10h4v10H4zM10 10h4v1.5c.6-1 1.8-1.7 3.2-1.7 2.7 0 3.8 1.6 3.8 4.4V20h-4v-5.2'
                 'c0-1.3-.4-2.1-1.5-2.1-1 0-1.5.7-1.5 2.1V20h-4z"/>')

CYAN, NAVY = "#9bf1ff", "#242943"
IC = {
    "mail": icon(CYAN, PATH_MAIL),
    "phone": icon(CYAN, PATH_PHONE),
    "globe": icon(CYAN, PATH_GLOBE),
    "github_d": icon_filled("#3d4468", PATH_GITHUB),
    "linkedin_d": icon_filled("#3d4468", PATH_LINKEDIN),
    "globe_d": icon("#3d4468", PATH_GLOBE),
    "mail_d": icon("#3d4468", PATH_MAIL),
    "phone_d": icon("#3d4468", PATH_PHONE),
}


# ---------------------------------------------------------------- card CSS
# Shared by the screen preview and the PDFs. --bleed is 0 on screen and 3mm for
# the print-shop files; the artwork grows into the bleed while the content stays
# inside the trim box.
CARD_CSS = """
.face {
	--bleed: 0mm;
	--w: 85.6mm;
	--h: 54mm;
	position: relative;
	width: calc(var(--w) + 2 * var(--bleed));
	height: calc(var(--h) + 2 * var(--bleed));
	padding: var(--bleed);
	overflow: hidden;
	font-family: var(--card-font);
	font-weight: 400;
	line-height: 1.35;
}

.face .inner { position: relative; width: 100%; height: 100%; display: flex; }

/* hairline sitting just inside the trim edge */
.face .inner::after {
	content: "";
	position: absolute;
	inset: 2.2mm;
	border: 0.25mm solid var(--rule);
	border-radius: 1.6mm;
	pointer-events: none;
}

/* ---------- front ---------- */
.face.front {
	background: linear-gradient(135deg, #242943 0%, #2a2f4a 55%, #363c62 100%);
	color: #fff;
	--rule: rgba(155, 241, 255, 0.32);
}

/* No panel or rule here: any hard edge near the trim line shows up as a sliver
   if the guillotine wanders, so the left third is just gradient plus portrait. */
.face.front .portrait-col {
	flex: 0 0 auto;
	display: flex;
	align-items: center;
}

.face.front .portrait-col img {
	width: 22.5mm;
	height: 22.5mm;
	object-fit: cover;
	object-position: top center;
	border-radius: 50%;
	border: 0.55mm solid #9bf1ff;
}

/* Portrait and text are sized to their content and centred as one group, so the
   pair stays optically centred whatever the length of the name and the role. */
.face.front .inner {
	align-items: center;
	justify-content: center;
	gap: 4.5mm;
	padding: 0 4.5mm;
}

.face.front .info-col {
	flex: 0 1 auto;
	min-width: 0;
	display: flex;
	flex-direction: column;
}

.face .name {
	font-size: 15pt;
	font-weight: 600;
	letter-spacing: 0.005em;
	line-height: 1.05;
}

.face .name.cjk { font-size: 19pt; font-weight: 500; letter-spacing: 0.06em; }

.face .accent {
	height: 0.45mm;
	width: 11mm;
	background: #9bf1ff;
	margin: 2.6mm 0;
}

.face .role {
	font-size: 6.2pt;
	color: #9bf1ff;
}

.face .role.caps { letter-spacing: 0.09em; text-transform: uppercase; }

/* ---------- back ---------- */
.face.back {
	background: #ffffff;
	color: #242943;
	--rule: rgba(36, 41, 67, 0.16);
}

.face.back .inner {
	align-items: center;
	gap: 5.5mm;
	padding: 0 6.5mm;
}

.face.back .qr-col {
	flex: 0 0 auto;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 1.6mm;
}

.face.back img.qr { width: 27mm; height: 27mm; display: block; }

.face.back .qr-col .cap { font-size: 5.4pt; color: #6b7192; }
.face.back .qr-col .cap.caps { letter-spacing: 0.14em; text-transform: uppercase; }

.face.back ul.contact {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 1.9mm;
	font-size: 6.3pt;
	color: #2f3554;
	min-width: 0;
}

.face.back ul.contact li { display: flex; align-items: center; gap: 1.9mm; }
.face.back ul.contact img.ic { width: 2.7mm; height: 2.7mm; flex: 0 0 auto; }
.face.back ul.contact a { color: inherit; text-decoration: none; }
"""


# ---------------------------------------------------------------- faces
def front(lang, prefix=""):
    """Name, role, portrait. Everything else lives on the back."""
    t = L[lang]
    caps = " caps" if t["upper"] else ""
    # Each card is written in one language only: no Latin name on the Chinese
    # card, no Chinese name on the English or French ones.
    pcls = " cjk" if lang == "zh" else ""
    return f"""<div class="face front">
	<div class="inner">
		<div class="portrait-col">
			<img src="{prefix}images/profile.jpg" alt="" />
		</div>
		<div class="info-col">
			<div class="name{pcls}">{t['name']}</div>
			<div class="accent"></div>
			<div class="role{caps}">{t['role']}</div>
		</div>
	</div>
</div>"""


def back(lang, prefix=""):
    """The QR, and every way of reaching me."""
    t = L[lang]
    caps = " caps" if t["upper"] else ""
    phones = "\n\t\t\t".join(
        f'<li><img class="ic" src="{IC["phone_d"]}" alt="" />'
        f'<a href="tel:{p.replace(" ", "")}">{p}</a></li>'
        for p in PHONES[lang]
    )
    return f"""<div class="face back">
	<div class="inner">
		<div class="qr-col">
			<img class="qr" src="{prefix}{t['qr']}" alt="" />
			<span class="cap{caps}">{t['qr_cap']}</span>
		</div>
		<ul class="contact">
			<li><img class="ic" src="{IC['mail_d']}" alt="" /><a href="mailto:{EMAIL}">{EMAIL}</a></li>
			{phones}
			<li><img class="ic" src="{IC['globe_d']}" alt="" /><a href="{SITE}">jerome-kai.github.io</a></li>
			<li><img class="ic" src="{IC['github_d']}" alt="" />{GITHUB}</li>
			<li><img class="ic" src="{IC['linkedin_d']}" alt="" />{LINKEDIN_TXT}</li>
		</ul>
	</div>
</div>"""


# ---------------------------------------------------------------- screen page
def screen_page(lang):
    t = L[lang]
    switch = "\n\t\t\t\t".join(
        f'<span class="current">{label}</span>' if code == lang
        else f'<a href="{href}" hreflang="{HREFLANG[code]}">{label}</a>'
        for code, label, href in SWITCH
    )
    alts = "\n\t\t".join(
        f'<link rel="alternate" hreflang="{HREFLANG[c]}" href="{SITE}/{L[c]["page"]}" />' for c in LANGS
    )
    font = ('"Source Sans Pro", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", Helvetica, sans-serif'
            if lang == "zh" else '"Source Sans Pro", Helvetica, sans-serif')

    return f"""<!DOCTYPE HTML>
<!--
	Business card of {PLAIN[lang]}.
	Generated: the faces below are laid out in millimetres, so what you see here is
	the same artwork as the PDFs in downloads/.
-->
<html lang="{t['html_lang']}">
	<head>
		<title>{t['title']}</title>
		<meta charset="utf-8" />
		<meta name="description" content="{t['desc']}" />
		<meta name="author" content="{PLAIN[lang]}" />
		<meta property="og:type" content="website" />
		<meta property="og:site_name" content="{PLAIN[lang]}" />
		<meta property="og:title" content="{t['title']}" />
		<meta property="og:description" content="{t['desc']}" />
		<meta property="og:url" content="{SITE}/{t['page']}" />
		<meta property="og:image" content="{SITE}/images/social-card.png" />
		<meta name="twitter:card" content="summary_large_image" />
		{alts}
		<link rel="icon" href="favicon.svg" type="image/svg+xml" />
		<link rel="alternate icon" href="favicon-32.png" sizes="32x32" />
		<link rel="apple-touch-icon" href="apple-touch-icon.png" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<style>
			@import url("assets/css/fonts.css");

			:root {{
				--card-font: {font};
				--accent: #9bf1ff;
				--scale: 1.45;
			}}

			* {{ box-sizing: border-box; margin: 0; padding: 0; }}

			body {{
				background: #1d2237;
				color: #fff;
				font-family: var(--card-font);
				min-height: 100vh;
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 2rem;
				padding: 2.5rem 1rem 3.5rem 1rem;
			}}

			h1 {{
				font-weight: 600;
				letter-spacing: 0.15em;
				text-transform: uppercase;
				font-size: 1.05rem;
				text-align: center;
			}}

			.lang-switch {{
				display: flex;
				gap: 0.35rem;
				align-items: center;
				font-size: 0.72rem;
				letter-spacing: 0.12em;
				text-transform: uppercase;
			}}

			.lang-switch a, .lang-switch .current {{
				padding: 0.35rem 0.75rem;
				border: 1px solid rgba(155, 241, 255, 0.35);
				border-radius: 3px;
				text-decoration: none;
				color: #fff;
			}}

			.lang-switch a:hover {{ background: rgba(155, 241, 255, 0.15); }}
			.lang-switch .current {{ background: var(--accent); color: #242943; border-color: var(--accent); }}

			/* Each face is drawn at its true physical size, then scaled up for the
			   screen, so the preview cannot drift from the printed result. */
			.faces {{ display: flex; flex-wrap: wrap; gap: 2.5rem; justify-content: center; }}

			.slot {{ display: flex; flex-direction: column; align-items: center; gap: 0.7rem; }}

			.slot .cap {{
				font-size: 0.62rem;
				letter-spacing: 0.2em;
				text-transform: uppercase;
				color: rgba(255, 255, 255, 0.5);
			}}

			.frame {{
				width: calc(85.6mm * var(--scale));
				height: calc(54mm * var(--scale));
				border-radius: 3mm;
				overflow: hidden;
				box-shadow: 0 14px 38px rgba(0, 0, 0, 0.5);
			}}

			.frame .face {{ transform: scale(var(--scale)); transform-origin: top left; }}

{CARD_CSS}

			/* ---- page chrome ---- */
			.block {{ display: flex; flex-direction: column; align-items: center; gap: 0.9rem; }}

			.block h2 {{
				font-size: 0.68rem;
				font-weight: 400;
				letter-spacing: 0.2em;
				text-transform: uppercase;
				color: rgba(255, 255, 255, 0.5);
			}}

			.block .note {{
				font-size: 0.78rem;
				font-weight: 300;
				color: rgba(255, 255, 255, 0.55);
				max-width: 32rem;
				text-align: center;
			}}

			.actions {{ display: flex; flex-wrap: wrap; justify-content: center; gap: 0.8rem; }}

			.actions a, .actions button {{
				font-family: inherit;
				background: transparent;
				border: 2px solid var(--accent);
				color: #fff;
				padding: 0.6rem 1.5rem;
				letter-spacing: 0.14em;
				text-transform: uppercase;
				font-size: 0.68rem;
				cursor: pointer;
				text-decoration: none;
				transition: background 0.2s, color 0.2s;
			}}

			.actions a:hover, .actions button:hover {{ background: var(--accent); color: #242943; }}
			.actions.subtle a {{ border-color: rgba(155, 241, 255, 0.35); }}

			@media (max-width: 1100px) {{ :root {{ --scale: 1.2; }} }}
			@media (max-width: 480px) {{ :root {{ --scale: 1.08; }} body {{ padding: 1.5rem 0.6rem 2.5rem 0.6rem; }} }}
			@media (max-width: 380px) {{ :root {{ --scale: 0.95; }} }}

			@media print {{
				body {{ background: #fff; padding: 0; gap: 0; display: block; }}
				h1, .lang-switch, .block, .slot .cap {{ display: none; }}
				.faces {{ display: block; gap: 0; }}
				.frame {{ width: 85.6mm; height: 54mm; border-radius: 0; box-shadow: none; page-break-after: always; }}
				.frame .face {{ transform: none; }}
				.face {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
			}}

			@page {{ size: 85.6mm 54mm; margin: 0; }}
		</style>
	</head>
	<body>

		<h1>{t['h1']}</h1>

		<nav class="lang-switch">
				{switch}
		</nav>

		<div class="faces">
			<div class="slot">
				<span class="cap">{t['front_label']}</span>
				<div class="frame">{front(lang)}</div>
			</div>
			<div class="slot">
				<span class="cap">{t['back_label']}</span>
				<div class="frame">{back(lang)}</div>
			</div>
		</div>

		<div class="block">
			<div class="actions">
				<button onclick="window.print()">{t['print']}</button>
				<a href="{t['home']}">{t['back_site']}</a>
			</div>
		</div>

		<div class="block">
			<h2>{t['dl_head']}</h2>
			<div class="actions">
				<a href="downloads/business-card-en.pdf" download>PDF &middot; English</a>
				<a href="downloads/business-card-fr.pdf" download>PDF &middot; Fran&ccedil;ais</a>
				<a href="downloads/business-card-zh.pdf" download>PDF &middot; &#20013;&#25991;</a>
				<a href="downloads/business-card-all.pdf" download>PDF &middot; {t['pdf_all']}</a>
			</div>
		</div>

		<div class="block">
			<h2>{t['shop_head']}</h2>
			<p class="note">{t['shop_note']}</p>
			<div class="actions subtle">
				<a href="downloads/business-card-en-print.pdf" download>English</a>
				<a href="downloads/business-card-fr-print.pdf" download>Fran&ccedil;ais</a>
				<a href="downloads/business-card-zh-print.pdf" download>&#20013;&#25991;</a>
			</div>
		</div>

	</body>
</html>
"""


# ---------------------------------------------------------------- print docs
CROP = """
.sheet {
	position: relative;
	width: 97.6mm;
	height: 66mm;
	page-break-after: always;
	overflow: hidden;
}
.sheet:last-child { page-break-after: auto; }
.sheet .face { position: absolute; top: 3mm; left: 3mm; }
.mark { position: absolute; background: #000; }
"""


def crop_marks():
    """Eight hairlines in the 3mm margin outside the bleed, aligned with the trim box."""
    m, out = [], []
    # trim box sits at 6mm from each sheet edge; sheet is 97.6 x 66
    for x in ("6mm", "91.6mm"):
        for y0 in ("0", "60mm"):
            m.append(f'<div class="mark" style="left:{x};top:{y0};width:0.15mm;height:6mm;"></div>')
    for y in ("6mm", "60mm"):
        for x0 in ("0", "91.6mm"):
            m.append(f'<div class="mark" style="top:{y};left:{x0};height:0.15mm;width:6mm;"></div>')
    out.extend(m)
    return "".join(out)


def print_doc(faces, font, bleed):
    """faces: list of html strings. bleed=True wraps each in a crop-marked sheet."""
    if bleed:
        pages = "\n".join(f'<div class="sheet">{crop_marks()}{f}</div>' for f in faces)
        page_rule = "@page { size: 97.6mm 66mm; margin: 0; }"
        extra = CROP + "\n.face { --bleed: 3mm; }"
    else:
        pages = "\n".join(f'<div class="sheet">{f}</div>' for f in faces)
        page_rule = "@page { size: 85.6mm 54mm; margin: 0; }"
        extra = (".sheet { width: 85.6mm; height: 54mm; page-break-after: always; }"
                 "\n.sheet:last-child { page-break-after: auto; }")
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
@import url("file://{REPO}/assets/css/fonts.css");
{page_rule}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
html, body {{ background: #fff; }}
body {{ --card-font: {font}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
{CARD_CSS}
{extra}
</style></head><body>
{pages}
</body></html>"""


PRINT_FONT = {
    "en": '"Source Sans Pro", "Noto Sans CJK SC", "WenQuanYi Zen Hei", Helvetica, sans-serif',
    "fr": '"Source Sans Pro", "Noto Sans CJK SC", "WenQuanYi Zen Hei", Helvetica, sans-serif',
    "zh": '"Source Sans Pro", "Noto Sans CJK SC", "WenQuanYi Zen Hei", sans-serif',
}
FONT_ALL = '"Source Sans Pro", "Noto Sans CJK SC", "WenQuanYi Zen Hei", sans-serif'

# Any Chrome/Chromium will do; override with the CHROME environment variable.
CHROME = os.environ.get("CHROME") or shutil.which("chromium") or shutil.which("chromium-browser") \
    or shutil.which("google-chrome") or "chromium"


def to_pdf(html_path, pdf_path):
    subprocess.run(
        [CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--no-pdf-header-footer",
         "--run-all-compositor-stages-before-draw", "--virtual-time-budget=10000",
         f"--print-to-pdf={pdf_path}", f"file://{html_path}"],
        check=True, capture_output=True,
    )


def outline_text(pdf_path):
    """Convert text to vector paths so a print shop needs no fonts at all."""
    gs = os.environ.get("GS") or shutil.which("gs")
    if not gs:
        print(f"  (ghostscript not found, leaving fonts in {pdf_path.name})")
        return
    tmp = pdf_path.with_suffix(".tmp.pdf")
    subprocess.run(
        [gs, "-q", "-dBATCH", "-dNOPAUSE", "-sDEVICE=pdfwrite", "-dNoOutputFonts",
         "-dAutoRotatePages=/None", "-dColorConversionStrategy=/LeaveColorUnchanged",
         f"-sOutputFile={tmp}", str(pdf_path)],
        check=True, capture_output=True,
    )
    tmp.replace(pdf_path)


def build_qr():
    """One QR per language, each pointing at that language's projects page."""
    import qrcode
    from qrcode.constants import ERROR_CORRECT_H
    for lang in LANGS:
        qr = qrcode.QRCode(error_correction=ERROR_CORRECT_H, box_size=16, border=2)
        qr.add_data(f"{SITE}/{L[lang]['projects']}")
        qr.make(fit=True)
        img = qr.make_image(fill_color=NAVY, back_color="white").convert("RGB")
        img.save(REPO / L[lang]["qr"])


def build():
    out = REPO / "downloads"
    out.mkdir(exist_ok=True)
    build_qr()
    fp = f"file://{REPO}/"

    # screen pages
    for lang in LANGS:
        (REPO / L[lang]["page"]).write_text(screen_page(lang), encoding="utf-8")

    # per-language PDFs, exact trim size and print-shop bleed
    for lang in LANGS:
        faces = [front(lang, fp), back(lang, fp)]
        for bleed, suffix in ((False, ""), (True, "-print")):
            h = HERE / f"print-{lang}{suffix}.html"
            h.write_text(print_doc(faces, PRINT_FONT[lang], bleed), encoding="utf-8")
            pdf = out / f"business-card-{lang}{suffix}.pdf"
            to_pdf(h, pdf)
            if bleed:
                outline_text(pdf)

    # all three languages, trim size
    faces = []
    for lang in LANGS:
        faces += [front(lang, fp), back(lang, fp)]
    h = HERE / "print-all.html"
    h.write_text(print_doc(faces, FONT_ALL, False), encoding="utf-8")
    to_pdf(h, out / "business-card-all.pdf")

    print("built")


if __name__ == "__main__":
    build()
