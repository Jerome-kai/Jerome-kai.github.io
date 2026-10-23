# Writes the schema.org JSON-LD block into the home and About pages.
#
# Idempotent: the block is delimited by an id, so re-running replaces it rather
# than stacking another. Everything in it is a fact the site already publishes -
# the name in each language, the school, the two profile links. The email address
# and phone numbers are deliberately left out: they are on the pages for people
# to read, and there is no reason to hand them to scrapers in machine-readable
# form as well.
import json, pathlib, re

REPO = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://jerome-kai.github.io"
PERSON_ID = f"{SITE}/#person"

# One entry per language. The three names are listed against each other as
# alternateName, because that link is the whole point: it is what lets a search
# for "吴锴" and a search for "Jerome-Kai Wu" land on the same person.
LANG = {
    "en": dict(code="en", name="Jerome-Kai Wu", home="index.html", about="landing.html",
               title="Mechanical engineering student",
               school="University of Technology of Compiègne",
               lycee="Lycée Français de Shanghai"),
    "fr": dict(code="fr", name="Jérôme-Kai Wu", home="index-fr.html", about="about-fr.html",
               title="Étudiant en ingénierie mécanique",
               school="Université de Technologie de Compiègne",
               lycee="Lycée Français de Shanghai"),
    "zh": dict(code="zh-Hans", name="吴锴", home="index-zh.html", about="about-zh.html",
               title="机械工程专业学生",
               school="贡比涅技术大学",
               lycee="上海法国学校"),
}
NAMES = [LANG[k]["name"] for k in ("en", "fr", "zh")]
SAME_AS = ["https://github.com/Jerome-kai", "https://www.linkedin.com/in/jerome-kai-wu-137653386/"]


def meta(html, prop):
    m = re.search(rf'<meta {prop} content="([^"]*)"', html)
    return m.group(1) if m else None


def person(L):
    return {
        "@type": "Person",
        "@id": PERSON_ID,
        "name": L["name"],
        "alternateName": [n for n in NAMES if n != L["name"]],
        "jobTitle": L["title"],
        # The same on every page and in every language: one person, one address.
        "url": f"{SITE}/",
        "image": f"{SITE}/images/profile.jpg",
        "knowsLanguage": ["fr", "zh", "en"],
        # Current enrolment is an affiliation; the lycée is finished, so alumni.
        "affiliation": {
            "@type": "CollegeOrUniversity", "name": L["school"], "alternateName": "UTC",
            "url": "https://www.utc.fr",
            "address": {"@type": "PostalAddress", "addressLocality": "Compiègne", "addressCountry": "FR"},
        },
        "alumniOf": {
            "@type": "School", "name": L["lycee"],
            "address": {"@type": "PostalAddress", "addressLocality": "Shanghai", "addressCountry": "CN"},
        },
        "sameAs": SAME_AS,
    }


def graph_for(kind, lang, html):
    L = LANG[lang]
    page = L["home"] if kind == "home" else L["about"]
    url = f"{SITE}/" if page == "index.html" else f"{SITE}/{page}"
    desc = meta(html, 'name="description"')
    nodes = []
    if kind == "home":
        nodes.append({
            # One WebSite per language version, so the three pages do not make
            # three conflicting claims about a single entity.
            "@type": "WebSite", "@id": f"{url}#website", "url": url,
            "name": L["name"], "inLanguage": L["code"], "description": desc,
            "publisher": {"@id": PERSON_ID},
        })
    else:
        nodes.append({
            "@type": "ProfilePage", "@id": f"{url}#profile", "url": url,
            "name": meta(html, 'property="og:title"'), "inLanguage": L["code"],
            "description": desc, "mainEntity": {"@id": PERSON_ID},
        })
    nodes.append(person(L))
    return {"@context": "https://schema.org", "@graph": nodes}


BLOCK = re.compile(r'\t\t<script type="application/ld\+json" id="jsonld">.*?</script>\n', re.S)


def inject():
    done = []
    for lang, L in LANG.items():
        for kind in ("home", "about"):
            path = REPO / L["home" if kind == "home" else "about"]
            html = path.read_text(encoding="utf-8")
            data = json.dumps(graph_for(kind, lang, html), ensure_ascii=False, indent="\t")
            data = data.replace("</", "<\\/")          # cannot close the script tag early
            tag = ('\t\t<script type="application/ld+json" id="jsonld">\n'
                   + "\n".join("\t\t" + ln for ln in data.splitlines())
                   + '\n\t\t</script>\n')
            html = BLOCK.sub("", html)
            anchor = '\t\t<link rel="icon" href="favicon.svg"'
            assert anchor in html, f"{path.name}: no anchor"
            html = html.replace(anchor, tag + anchor, 1)
            path.write_text(html, encoding="utf-8")
            done.append(path.name)
    print("JSON-LD written to:", ", ".join(done))


if __name__ == "__main__":
    inject()
