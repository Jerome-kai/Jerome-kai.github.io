# Builds the English and Chinese CVs from the French one.
#
# The French PDF is authored in Word and committed as-is; this script does not
# touch it. It reproduces that document's design in CSS and pours the two
# translations into it, so all three read as the same CV in three languages
# rather than three different documents.
#
# Every measurement below was taken off the French PDF (colours, point sizes,
# margins, the portrait's placement), and the body font is Carlito, which is
# metric-compatible with the Calibri the original uses.
#
#   python3 tools/build-cv.py            # needs CHROME= if chromium is not on PATH
import os, pathlib, shutil, subprocess, tempfile

REPO = pathlib.Path(__file__).resolve().parent.parent
OUT = REPO / "downloads"
FR_PDF = OUT / "cv-fr.pdf"

CHROME = (os.environ.get("CHROME") or shutil.which("chromium") or shutil.which("chromium-browser")
          or shutil.which("google-chrome") or "chromium")

# ---------------------------------------------------------------- palette
NAVY = "#1a3a5c"      # name, section headings, skill labels
RULE = "#2e75b6"      # the rule under each section heading
INK = "#222222"       # body text
MUTED = "#555555"     # role lines, dates, the contact line

EMAIL = "wu.jerome.kai@gmail.com"
PHONE_FR = "+33 621 222 993"
PHONE_CN = "+86 134 7270 4378"

# ---------------------------------------------------------------- content
# Each entry is (organisation, role, dates, [bullets]); a role of None prints
# nothing on that line. Sub-lines are for the two-dates-one-school case in the
# education section, which the French original sets as its own indented rows.
CV = {
    "en": {
        "lang": "en",
        "font": "'Carlito', 'Noto Sans CJK SC', sans-serif",
        "role_style": "italic",
        "name": "Jerome-Kai WU",
        "mobility": "Mobility: France and international",
        "phones": [PHONE_FR],
        "objective": "Seeking a 6-month mechanical engineering assistant internship "
                     "(4th year) starting 24/08/2026",
        "sections": [
            ("Education", [
                {"org": "University of Technology of Compi&egrave;gne &mdash; Compi&egrave;gne, France",
                 "role": "Working towards the French engineering degree in mechanical engineering",
                 "rows": [("Integrated preparatory cycle [GPA: 3.74/5]", "09/2023 &ndash; 07/2025"),
                          ("First year of the engineering cycle [GPA: 4.26/5]", "09/2025 &ndash; 07/2028")],
                 "bullets": ["Coursework: mechanical analysis and design (strength of materials, statics, "
                             "fluid mechanics), CAD, programming, electronics and microcontrollers, "
                             "mathematics (linear algebra, calculus), design, geometrical optics, "
                             "electrical machines."]},
                {"org": "Lyc&eacute;e Fran&ccedil;ais de Shanghai &mdash; Shanghai, China",
                 "role": "French Baccalaur&eacute;at &mdash; highest honours (Mention Tr&egrave;s Bien)",
                 "dates": "09/2020 &ndash; 07/2023",
                 "bullets": ["Specialisms: mathematics, physics and chemistry."]},
            ]),
            ("Experience", [
                {"org": "Zhejiang Ruicheng New Materials Co., Ltd. &mdash; Zhejiang, China",
                 "role": "Factory internship", "dates": "07/2024 &ndash; 08/2024",
                 "bullets": ["Rotated through the logistics department, the R&amp;D laboratory and the "
                             "hydrolysis workshop of a chemical company.",
                             "Gained a concrete understanding of industrial organisation and production "
                             "processes, taking an active part in technical work on the shop floor."]},
            ]),
            ("Projects", [
                {"org": "UTC &mdash; Drone Club &middot; Compi&egrave;gne, France",
                 "role": "Member", "dates": "02/2026 &ndash; present",
                 "bullets": ["Designed sub-systems in Fusion 360 and 3D-printed them for the fixed-wing "
                             "drone prototype the club is building.",
                             "Contributed to the design of the on-board electronics (Pixhawk, Arduino)."]},
                {"org": "UTC &mdash; University project: SemiTeach inverter &middot; Compi&egrave;gne, France",
                 "role": "Supervised individual project", "dates": "02/2026 &ndash; present",
                 "bullets": ["Built a teaching-lab rig for studying the operation and control of a "
                             "SemiTeach inverter (Semikron).",
                             "Developed the control system in C through PLECS."]},
                {"org": "UTC &mdash; University project: cheese-wheel turner &middot; Compi&egrave;gne, France",
                 "role": "Project in a pair", "dates": "02/2026 &ndash; present",
                 "bullets": ["Complete design of a manual cheese-wheel turner: functional analysis, "
                             "mechanical sizing and CAD modelling in PTC Creo Parametric."]},
            ]),
        ],
        "skills_head": "Skills &amp; Interests",
        "skills": [
            ("CAD &amp; CAM:", "Creo (intermediate), Fusion 360 (intermediate), G-code (basics)"),
            ("Programming:", "Python (intermediate), HTML/CSS (intermediate), SQL (intermediate), "
                             "HC12 assembly (intermediate), C (basics), Java (basics), PHP (basics)"),
            ("Languages:", "French C2 (native), Mandarin C2 (native), English B2 (upper intermediate), "
                           "Japanese A1, Spanish A1"),
            ("Interests:", "Mechanical analysis, embedded electronics, programming, artificial intelligence"),
        ],
    },
    "zh": {
        "lang": "zh-Hans",
        "font": "'Noto Sans CJK SC', 'Carlito', sans-serif",
        # Chinese has no italic tradition: a synthetic oblique on Hanzi reads as
        # a machine-typesetting artefact, so these lines stay upright.
        "role_style": "normal",
        "name": "吴锴",
        "mobility": "工作地点：法国及海外",
        # A Chinese-language CV goes to people who would dial the +86 number,
        # so it carries both, the same way the Chinese business card does.
        "phones": [PHONE_CN, PHONE_FR],
        "objective": "求职意向：2026 年 8 月 24 日起为期六个月的机械工程助理实习（工程师阶段四年级）",
        "sections": [
            ("教育经历", [
                {"org": "贡比涅技术大学 &mdash; 法国，贡比涅",
                 "role": "机械工程师文凭在读",
                 "rows": [("校内预科阶段［GPA：3.74/5］", "2023/09 &ndash; 2025/07"),
                          ("工程师阶段一年级［GPA：4.26/5］", "2025/09 &ndash; 2028/07")],
                 "bullets": ["课程：机械分析与设计（材料力学、静力学、流体力学）、计算机辅助设计、编程、"
                             "电子与单片机、数学（线性代数、数学分析）、机械设计、几何光学、电机。"]},
                {"org": "上海法国学校 &mdash; 中国，上海",
                 "role": "法国高中会考文凭 &mdash; 优异等级（Mention Tr&egrave;s Bien）",
                 "dates": "2020/09 &ndash; 2023/07",
                 "bullets": ["选修方向：数学、物理与化学。"]},
            ]),
            ("实习经历", [
                {"org": "浙江瑞城新材料有限公司 &mdash; 中国，浙江",
                 "role": "生产实习", "dates": "2024/07 &ndash; 2024/08",
                 "bullets": ["在一家化工企业的物流部门、研发实验室和水解车间轮岗实习。",
                             "具体了解了工业组织方式与生产流程，并实际参与车间的技术工作。"]},
            ]),
            ("项目经历", [
                {"org": "贡比涅技术大学 &mdash; 无人机社团 &middot; 法国，贡比涅",
                 "role": "成员", "dates": "2026/02 至今",
                 "bullets": ["在社团研制固定翼无人机原型的过程中，用 Fusion 360 设计各子系统并完成 3D 打印。",
                             "参与机载电子系统（Pixhawk、Arduino）的设计。"]},
                {"org": "贡比涅技术大学 &mdash; 课程项目：SemiTeach 逆变器 &middot; 法国，贡比涅",
                 "role": "独立指导项目", "dates": "2026/02 至今",
                 "bullets": ["制作用于研究 SemiTeach（Semikron）逆变器工作原理与控制方式的教学实验台。",
                             "通过 PLECS 用 C 语言开发控制系统。"]},
                {"org": "贡比涅技术大学 &mdash; 课程项目：奶酪轮翻转机 &middot; 法国，贡比涅",
                 "role": "双人项目", "dates": "2026/02 至今",
                 "bullets": ["完整设计一台手动奶酪轮翻转机：功能分析、机械选型计算，"
                             "并用 PTC Creo Parametric 完成三维建模。"]},
            ]),
        ],
        "skills_head": "技能与兴趣",
        "skills": [
            ("CAD 与 CAM：", "Creo（中级）、Fusion 360（中级）、G 代码（入门）"),
            ("编程：", "Python（中级）、HTML/CSS（中级）、SQL（中级）、HC12 汇编（中级）、"
                     "C（入门）、Java（入门）、PHP（入门）"),
            ("语言：", "法语 C2（母语）、普通话 C2（母语）、英语 B2（中高级）、日语 A1、西班牙语 A1"),
            ("兴趣：", "机械计算、嵌入式电子、编程、人工智能"),
        ],
    },
}

# ---------------------------------------------------------------- template
# Sizes and margins are in points, straight off the French PDF: 49pt side
# margins, an 83.1 x 104.2pt portrait, 16pt name, 11pt headings, 9.5pt body.
CSS = """
@page { size: A4; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
	width: 595.3pt;
	height: 841.9pt;
	padding: 45pt 48.8pt 34pt 49pt;
	font-family: %(font)s;
	font-size: 9.5pt;
	line-height: 1.28;
	color: %(ink)s;
	-webkit-font-smoothing: antialiased;
}

/* ---------- header ---------- */
.head { display: flex; align-items: center; gap: 16pt; margin-bottom: 16pt; }
.head img { width: 83.1pt; height: 104.2pt; object-fit: cover; object-position: top center; }
.head h1 { font-size: 16pt; font-weight: 700; color: %(navy)s; letter-spacing: 0.01em; }
.head .contact { font-size: 9pt; color: %(muted)s; margin-top: 6pt; }

/* The objective sits on its own rule, narrower than the section rules, exactly
   as in the French original. */
.objective {
	font-size: 11pt; font-weight: 700; color: %(navy)s;
	display: inline-block; padding-bottom: 3pt; border-bottom: 0.8pt solid %(navy)s;
	margin-bottom: 12pt;
}

/* ---------- sections ---------- */
h2 {
	font-size: 11pt; font-weight: 700; color: %(navy)s;
	border-bottom: 1pt solid %(rule)s;
	padding-bottom: 2pt; margin: 11pt 0 6pt;
}
h2:first-of-type { margin-top: 0; }

.entry { margin-bottom: 7pt; }
.entry:last-child { margin-bottom: 0; }
.org { font-size: 10pt; font-weight: 700; color: %(ink)s; }

/* Role on the left, dates hard against the right margin. */
.line { display: flex; justify-content: space-between; align-items: baseline; gap: 12pt; }
.role { font-style: %(roleStyle)s; color: %(muted)s; }
.dates { color: %(muted)s; white-space: nowrap; flex: 0 0 auto; }

ul { list-style: none; margin-top: 1pt; }
li { padding-left: 12pt; position: relative; margin-top: 1.5pt; }
li::before { content: "\\25B8"; position: absolute; left: 2pt; color: %(ink)s; }

/* ---------- skills ---------- */
.skill { margin-top: 1.5pt; }
.skill b { color: %(navy)s; font-weight: 700; }
"""


def esc(s):
    return s


def render(lang):
    c = CV[lang]
    css = CSS % {"font": c["font"], "navy": NAVY, "rule": RULE, "ink": INK,
                   "muted": MUTED, "roleStyle": c["role_style"]}

    contact = " &nbsp;&middot;&nbsp; ".join([EMAIL] + c["phones"] + [c["mobility"]])

    body = []
    for head, entries in c["sections"]:
        body.append(f"<h2>{head}</h2>")
        for e in entries:
            body.append('<div class="entry">')
            body.append(f'<div class="org">{e["org"]}</div>')
            if e.get("rows"):
                # school with one qualification and several dated stages
                body.append(f'<div class="role">{e["role"]}</div>')
                for text, dates in e["rows"]:
                    body.append(f'<div class="line"><span class="role">{text}</span>'
                                f'<span class="dates">{dates}</span></div>')
            else:
                body.append(f'<div class="line"><span class="role">{e["role"]}</span>'
                            f'<span class="dates">{e.get("dates", "")}</span></div>')
            if e.get("bullets"):
                body.append("<ul>" + "".join(f"<li>{b}</li>" for b in e["bullets"]) + "</ul>")
            body.append("</div>")

    body.append(f'<h2>{c["skills_head"]}</h2>')
    for label, text in c["skills"]:
        body.append(f'<div class="skill"><b>{label}</b> {text}</div>')

    return f"""<!DOCTYPE html>
<html lang="{c['lang']}">
<head>
<meta charset="utf-8" />
<title>{c['name']}</title>
<style>{css}</style>
</head>
<body>
	<div class="head">
		<img src="portrait.jpeg" alt="" />
		<div>
			<h1>{c['name']}</h1>
			<div class="contact">{contact}</div>
		</div>
	</div>
	<div class="objective">{c['objective']}</div>
	{''.join(body)}
</body>
</html>"""


def to_pdf(html_path, pdf_path):
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="cv-"))
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox",
                    f"--user-data-dir={tmp}", "--no-pdf-header-footer",
                    f"--print-to-pdf={pdf_path}", html_path.as_uri()],
                   check=True, capture_output=True)
    shutil.rmtree(tmp, ignore_errors=True)


def main():
    OUT.mkdir(exist_ok=True)
    work = pathlib.Path(tempfile.mkdtemp(prefix="cv-src-"))
    shutil.copy(REPO / "images/cv/portrait.jpeg", work / "portrait.jpeg")

    import fitz
    for lang in ("en", "zh"):
        html = work / f"cv-{lang}.html"
        html.write_text(render(lang), encoding="utf-8")
        pdf = OUT / f"cv-{lang}.pdf"
        to_pdf(html, pdf)
        d = fitz.open(pdf)
        d.set_metadata({"title": f"{CV[lang]['name']} — Curriculum Vitae",
                        "author": CV[lang]["name"], "subject": "Curriculum Vitae",
                        "creator": "", "producer": ""})
        d.save(str(pdf.with_suffix(".tmp.pdf")), deflate=True, garbage=3)
        d.close()
        pdf.with_suffix(".tmp.pdf").replace(pdf)
        print(f"  {pdf.name}: {fitz.open(pdf).page_count} page(s)")

    # The site has linked /resume.pdf for a while; keep that URL alive and
    # generated, so it cannot drift from the French CV it mirrors.
    shutil.copy(FR_PDF, REPO / "resume.pdf")
    print("  resume.pdf <- cv-fr.pdf")


if __name__ == "__main__":
    main()
