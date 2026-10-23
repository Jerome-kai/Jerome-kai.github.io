# Builds games.html, games-fr.html and games-zh.html.
#
# Each page is cut from the Skills page of the same language, so its header,
# menu, contact block and footer are exactly those of the rest of the site in
# that language; only the head metadata and the main content are replaced.
# The games themselves live in assets/js/games/ and carry their own strings for
# everything that changes while playing; this file holds the static text.
import html, pathlib, re

REPO = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://jerome-kai.github.io"

T = {
    "en": dict(
        src="skills.html", out="games.html",
        title="Mini Games · Jerome-Kai Wu",
        desc="Three small browser games by Jerome-Kai Wu: land a drone, read a vernier caliper and tune a PID controller. Free, nothing to install.",
        h1="Mini Games",
        intro="Three small games built around things I actually work with: flying drones, reading measuring tools and tuning control loops. They run in your browser, and your best scores are kept on this device only.",
        drone="Soft Landing",
        drone_desc="Bring the drone down onto the pad gently enough not to break it, before the battery runs out. Every level the wind picks up and the pad gets narrower.",
        drone_how="Keyboard: ↑, W or Space for thrust, ← → or A D to drift, after clicking the screen. Touch: hold the buttons under it.",
        stage="Drone game. Click here, then fly with the keyboard.",
        left="Drift left", thrust="Thrust", right="Drift right", start="Start",
        caliper="Read the Caliper",
        caliper_desc="Ten readings against the clock. Take the last main-scale line before the vernier’s zero, then add the vernier line that lines up exactly with a line on the main scale.",
        caliper_how="Type the reading in millimetres and press Enter. Zoom in when the lines are hard to tell apart: a real one is often read under a loupe too.",
        res="Resolution", zoom="Zoom", zin="Zoom in", zout="Zoom out", modes=("0.1 mm", "0.05 mm"),
        answer="Your reading in millimetres", placeholder="e.g. 23.4", check="Check",
        pid="Tune the Loop",
        pid_desc="Set the three gains of a PID controller so the system reaches its target quickly, without overshooting too far, and stays there. Four systems, each needing something different.",
        pid_how="Drag the sliders and the response redraws as you go. Meeting every target earns a star; settling faster earns the second and third.",
        levels="Levels", level="Level {n}", reset="Reset gains",
        noscript="This game needs JavaScript.",
    ),
    "fr": dict(
        src="skills-fr.html", out="games-fr.html",
        title="Mini-jeux · Jérôme-Kai Wu",
        desc="Trois petits jeux de Jérôme-Kai Wu dans le navigateur : poser un drone, lire un pied à coulisse et régler un correcteur PID. Gratuit, sans installation.",
        h1="Mini-jeux",
        intro="Trois petits jeux autour de choses avec lesquelles je travaille vraiment : piloter des drones, lire des instruments de mesure et régler des boucles de régulation. Ils tournent dans votre navigateur, et vos meilleurs scores ne sont gardés que sur cet appareil.",
        drone="Atterrissage en douceur",
        drone_desc="Posez le drone sur la plateforme assez doucement pour ne pas le casser, avant que la batterie ne soit vide. À chaque niveau, le vent forcit et la plateforme rétrécit.",
        # The game reads physical key positions, so on an AZERTY keyboard the
        # W and A positions are labelled Z and Q.
        drone_how="Clavier : ↑, Z ou Espace pour la poussée, ← → ou Q D pour dériver, après avoir cliqué sur l’écran. Tactile : maintenez les boutons en dessous.",
        stage="Jeu du drone. Cliquez ici, puis pilotez au clavier.",
        left="Dériver à gauche", thrust="Poussée", right="Dériver à droite", start="Démarrer",
        caliper="Lire le pied à coulisse",
        caliper_desc="Dix lectures chronométrées. Prenez la dernière graduation de la règle avant le zéro du vernier, puis ajoutez le trait du vernier qui coïncide exactement avec une graduation de la règle.",
        caliper_how="Saisissez la lecture en millimètres et appuyez sur Entrée. Zoomez quand les traits sont difficiles à départager : un vrai se lit souvent à la loupe, lui aussi.",
        res="Résolution", zoom="Zoom", zin="Zoomer", zout="Dézoomer", modes=("0,1 mm", "0,05 mm"),
        answer="Votre lecture en millimètres", placeholder="ex. 23,4", check="Valider",
        pid="Régler la boucle",
        pid_desc="Réglez les trois gains d’un correcteur PID pour que le système atteigne vite sa consigne, sans trop la dépasser, et y reste. Quatre systèmes, chacun avec ses exigences.",
        pid_how="Déplacez les curseurs : la réponse se redessine en direct. Atteindre tous les objectifs donne une étoile ; une réponse plus rapide donne la deuxième et la troisième.",
        levels="Niveaux", level="Niveau {n}", reset="Réinitialiser les gains",
        noscript="Ce jeu nécessite JavaScript.",
    ),
    "zh": dict(
        src="skills-zh.html", out="games-zh.html",
        title="小游戏 · 吴锴",
        desc="吴锴的三个浏览器小游戏：降落无人机、读游标卡尺、调节 PID 控制器。免费，无需安装。",
        h1="小游戏",
        intro="三个小游戏，主题都来自我真正在做的事：飞无人机、读测量工具、调控制回路。它们都在浏览器里运行，最高分只保存在你自己的设备上。",
        drone="平稳降落",
        drone_desc="在电池耗尽之前，把无人机轻轻降落到停机坪上，别摔坏它。每过一关，风会更大，停机坪会更窄。",
        drone_how="键盘：先点击画面，然后用 ↑、W 或空格键加推力，← → 或 A D 左右平移。触屏：按住画面下方的按钮。",
        stage="无人机游戏。点击这里后用键盘操作。",
        left="向左平移", thrust="推力", right="向右平移", start="开始",
        caliper="读游标卡尺",
        caliper_desc="限时读数十次。先读出游标零线左侧最近的主尺刻度，再加上与主尺刻度完全对齐的那条游标刻线。",
        caliper_how="输入以毫米为单位的读数，按回车确认。刻线难以分辨时可以放大，真正的卡尺也常常要借助放大镜来读。",
        res="分度值", zoom="缩放", zin="放大", zout="缩小", modes=("0.1 mm", "0.05 mm"),
        answer="你的读数（毫米）", placeholder="例如 23.4", check="确定",
        pid="PID 调参",
        pid_desc="调节 PID 控制器的三个增益，让系统快速到达目标值、超调不过大，并稳定在那里。四个被控对象，各有不同的难点。",
        pid_how="拖动滑块，响应曲线会实时重绘。达到所有指标得一颗星，调节得更快可得第二、第三颗星。",
        levels="关卡", level="第 {n} 关", reset="重置增益",
        noscript="这个游戏需要启用 JavaScript。",
    ),
}

SCRIPTS = ["common", "drone", "caliper", "pid"]


def main_content(s):
    e = lambda x: html.escape(x, quote=True)
    level_chips = "\n".join(
        f'\t\t\t\t\t\t\t\t\t\t\t<button type="button" class="game__chip" data-level="{n}" aria-pressed="{"true" if n == 1 else "false"}" '
        f'aria-label="{e(s["level"].format(n=n))}">{n}<span class="pid__stars" aria-hidden="true"></span></button>'
        for n in (1, 2, 3, 4))
    gains = "\n".join(
        f'\t\t\t\t\t\t\t\t\t\t<label class="pid__gain"><span>K<sub>{k[1]}</sub></span><input type="range" data-gain="{k}" /><output>0</output></label>'
        for k in ("kp", "ki", "kd"))
    noscript = f'<noscript><p class="game__noscript">{e(s["noscript"])}</p></noscript>'
    return f"""<div id="main" class="alt">

					<!-- One -->
						<section id="one">
							<div class="inner">
								<header class="major">
									<h1>{e(s["h1"])}</h1>
								</header>
								<p class="games-intro">{e(s["intro"])}</p>
								<ul class="games-nav">
									<li><a href="#drone">{e(s["drone"])}</a></li>
									<li><a href="#caliper">{e(s["caliper"])}</a></li>
									<li><a href="#pid">{e(s["pid"])}</a></li>
								</ul>

								<section class="game game--drone" id="drone">
									<header class="game__head">
										<h2>{e(s["drone"])}</h2>
										<p>{e(s["drone_desc"])}</p>
										<p class="game__how">{e(s["drone_how"])}</p>
									</header>
									<div class="game__stage game__stage--drone" tabindex="0" aria-label="{e(s["stage"])}">
										<canvas role="img" aria-label="{e(s["drone"])}"></canvas>
										{noscript}
									</div>
									<div class="game__controls">
										<button type="button" class="game__pad" data-hold="left" aria-label="{e(s["left"])}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M16 5 7 12l9 7z"/></svg></button>
										<button type="button" class="game__pad" data-hold="thrust" aria-label="{e(s["thrust"])}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 16 12 7l7 9z"/></svg></button>
										<button type="button" class="game__pad" data-hold="right" aria-label="{e(s["right"])}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5l9 7-9 7z"/></svg></button>
										<button type="button" class="button primary small" data-act="go">{e(s["start"])}</button>
									</div>
									<p class="game__status" aria-live="polite"></p>
								</section>

								<section class="game game--caliper" id="caliper">
									<header class="game__head">
										<h2>{e(s["caliper"])}</h2>
										<p>{e(s["caliper_desc"])}</p>
										<p class="game__how">{e(s["caliper_how"])}</p>
									</header>
									<div class="game__toolbar">
										<div class="game__seg" role="group" aria-label="{e(s["res"])}">
											<button type="button" class="game__chip" data-mode="0.1" aria-pressed="true">{e(s["modes"][0])}</button>
											<button type="button" class="game__chip" data-mode="0.05" aria-pressed="false">{e(s["modes"][1])}</button>
										</div>
										<div class="game__seg" role="group" aria-label="{e(s["zoom"])}">
											<button type="button" class="game__chip" data-zoom="-" aria-label="{e(s["zout"])}">&minus;</button>
											<span class="caliper__zoom">1×</span>
											<button type="button" class="game__chip" data-zoom="+" aria-label="{e(s["zin"])}">+</button>
										</div>
										<span class="game__meta"></span>
									</div>
									<div class="game__stage game__stage--scroll">
										<canvas role="img" aria-label="{e(s["caliper"])}"></canvas>
										{noscript}
									</div>
									<form class="game__answer" autocomplete="off">
										<label for="caliper-answer" class="visually-hidden">{e(s["answer"])}</label>
										<input id="caliper-answer" type="text" inputmode="decimal" placeholder="{e(s["placeholder"])}" autocomplete="off" spellcheck="false" />
										<button type="submit" class="button primary small">{e(s["check"])}</button>
										<button type="button" class="button small" data-act="start">{e(s["start"])}</button>
									</form>
									<p class="game__status" aria-live="polite"></p>
								</section>

								<section class="game game--pid" id="pid">
									<header class="game__head">
										<h2>{e(s["pid"])}</h2>
										<p>{e(s["pid_desc"])}</p>
										<p class="game__how">{e(s["pid_how"])}</p>
									</header>
									<div class="game__toolbar">
										<div class="game__seg" role="group" aria-label="{e(s["levels"])}">
{level_chips}
										</div>
									</div>
									<p class="pid__brief"><strong class="pid__name"></strong> <span class="pid__hint"></span></p>
									<div class="game__stage">
										<canvas role="img" aria-label="{e(s["pid"])}"></canvas>
										{noscript}
									</div>
									<div class="pid__controls">
{gains}
										<button type="button" class="button small" data-act="reset">{e(s["reset"])}</button>
									</div>
									<div class="table-wrapper">
										<table class="pid__metrics"><thead></thead><tbody></tbody></table>
									</div>
									<p class="game__status" aria-live="polite"></p>
								</section>

							</div>
						</section>

"""


def build(lang):
    s = T[lang]
    page = (REPO / s["src"]).read_text(encoding="utf-8")
    head, sep, rest = page.partition("<!-- Menu -->")
    assert sep, f"{s['src']}: no menu marker"

    # head and header: point every self-reference at the games page
    head = re.sub(r"skills(-fr|-zh)?\.html", lambda m: f"games{m.group(1) or ''}.html", head)
    esc = lambda x: html.escape(x, quote=True)
    head = re.sub(r"<title>.*?</title>", f"<title>{esc(s['title'])}</title>", head, count=1)
    for attr, val in (('name="description"', s["desc"]), ('property="og:description"', s["desc"]),
                      ('property="og:title"', s["title"])):
        head, k = re.subn(rf'(<meta {re.escape(attr)} content=")[^"]*(")', lambda m: m.group(1) + esc(val) + m.group(2), head, count=1)
        assert k == 1, f"{lang}: {attr}"
    css = '\t\t<link rel="stylesheet" href="assets/css/print.css" media="print" />\n'
    assert css in head
    head = head.replace(css, '\t\t<link rel="stylesheet" href="assets/css/games.css" />\n' + css, 1)

    # main content
    start = rest.index('<div id="main" class="alt">')
    end = rest.index('\t\t\t\t\t</div>\n\n\t\t\t\t<!-- Contact -->')
    rest = rest[:start] + main_content(s) + rest[end:]

    tag = '\t\t\t<script src="assets/js/main.js"></script>\n'
    assert tag in rest
    rest = rest.replace(tag, tag + "".join(f'\t\t\t<script src="assets/js/games/{n}.js"></script>\n' for n in SCRIPTS), 1)

    (REPO / s["out"]).write_text(head + sep + rest, encoding="utf-8")
    assert len(s["desc"]) <= 165, (lang, len(s["desc"]))
    return s["out"]


if __name__ == "__main__":
    print("built:", ", ".join(build(l) for l in ("en", "fr", "zh")))
