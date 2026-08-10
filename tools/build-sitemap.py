# Regenerates sitemap.xml from the pages themselves, so the two cannot drift.
# Every URL, its lastmod and its hreflang alternates are read out of the HTML;
# nothing about the site is duplicated here.
import pathlib, re, subprocess, xml.sax.saxutils as X

REPO = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://jerome-kai.github.io"

# How prominent each page is, relative to the home page. Google ignores these,
# but other crawlers still read them and they cost nothing to state.
PRIORITY = {"index": "1.0", "projects": "0.9", "cv": "0.9", "landing": "0.8",
            "about": "0.8", "skills": "0.8", "imagegencam": "0.7",
            "cheese-machine": "0.7", "card": "0.6", "wechat": "0.3"}


def stem(name):
    """projects-fr.html -> projects. landing.html -> landing."""
    return re.sub(r"-(fr|zh)$", "", name[:-5])


def lastmod(name):
    out = subprocess.run(["git", "log", "-1", "--format=%cs", "--", name],
                         cwd=REPO, capture_output=True, text=True).stdout.strip()
    return out or None


def build():
    pages = []
    for p in sorted(REPO.glob("*.html")):
        t = p.read_text(encoding="utf-8")
        # A page that tells crawlers not to index it has no business in a sitemap.
        if re.search(r'<meta name="robots"[^>]*noindex', t):
            continue
        canon = re.search(r'<link rel="canonical" href="([^"]+)"', t)
        if not canon:
            raise SystemExit(f"{p.name} has no canonical URL")
        alts = re.findall(r'<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"', t)
        pages.append((p.name, canon.group(1), alts))

    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
             '        xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for name, url, alts in pages:
        lines.append("\t<url>")
        lines.append(f"\t\t<loc>{X.escape(url)}</loc>")
        if (lm := lastmod(name)):
            lines.append(f"\t\t<lastmod>{lm}</lastmod>")
        lines.append(f"\t\t<priority>{PRIORITY.get(stem(name), '0.5')}</priority>")
        # Each language version lists every version of itself, itself included,
        # which is what the hreflang spec asks for.
        for lang, href in alts:
            lines.append(f'\t\t<xhtml:link rel="alternate" hreflang="{lang}" href="{X.escape(href)}" />')
        if alts:
            en = next((h for l, h in alts if l == "en"), None)
            if en:
                lines.append(f'\t\t<xhtml:link rel="alternate" hreflang="x-default" href="{X.escape(en)}" />')
        lines.append("\t</url>")
    lines.append("</urlset>")
    (REPO / "sitemap.xml").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"sitemap.xml: {len(pages)} urls")


if __name__ == "__main__":
    build()
