#!/usr/bin/env python3
"""Кассета одной строкой: рисует SVG-ленту по настоящим вкладам.

Воркер ходит за живым манифестом профильного репозитория (его каждую ночь
пересобирает .github/workflows/profile.yml) и кладёт картинку в tape/<login>.svg.
Ни одно число здесь не вбито руками: всё берётся из манифеста.

Запуск: python3 scripts/tape.py [login]
Пишет:  tape/<login>.svg
"""
import json
import os
import sys
import urllib.request

MANIFEST = ("https://raw.githubusercontent.com/Alexander-Domanov/"
            "Alexander-Domanov/main/assets/out/manifest.json")
LOCAL_FALLBACK = "/root/github-profile/repo/assets/out/manifest.json"


def manifest():
    try:
        req = urllib.request.Request(MANIFEST, headers={"User-Agent": "tape-worker"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except Exception as exc:
        if os.path.exists(LOCAL_FALLBACK):
            print(f"live manifest unreachable ({exc}); using local copy", file=sys.stderr)
            with open(LOCAL_FALLBACK, encoding="utf-8") as fh:
                return json.load(fh)
        raise


def bar_color(v, top):
    if v <= 0:
        return "#17304a"
    if v >= top * 0.66:
        return "#9af03f"
    if v >= top * 0.33:
        return "#2ee6ff"
    return "#2ee6ff" if v else "#17304a"


def draw(data, login):
    stats = data["stats"]
    months = stats.get("months", [])[-12:]
    top = max([v for _, v in months] + [1])
    total = stats.get("contributions", 0)
    days = stats.get("active_days", 0)
    run = stats.get("longest_run", 0)
    last = stats.get("last_active", "")
    gen = data.get("generated_at", "")

    x0, gap, bw = 26, 6, 34
    base = 108
    bars = []
    for i, (name, v) in enumerate(months):
        h = round(v / top * 40)
        x = x0 + i * (bw + gap)
        y = base - h
        bars.append(
            f'<rect x="{x}" y="{y}" width="{bw}" height="{max(h, 2)}" rx="3" '
            f'fill="{bar_color(v, top)}"><title>{name}: {v}</title></rect>')
    strip = "\n  ".join(bars)

    head = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="520" height="150" '
        'viewBox="0 0 520 150" role="img" '
        'aria-label="contribution tape for %s: %d contributions on %d active days">' % (login, total, days),
        '  <rect x="8" y="8" width="504" height="134" rx="14" fill="#0c1728" '
        'stroke="rgba(46,230,255,.35)"/>',
        '  <text x="26" y="34" fill="#8fb6d6" font-family="ui-monospace,monospace" '
        'font-size="13" letter-spacing="1.5">domanov@vps: ~/tape 01 &#183; %s</text>' % login,
        '  <line x1="26" y1="46" x2="494" y2="46" stroke="rgba(46,230,255,.18)"/>',
        '  ' + strip,
        '  <text x="26" y="130" fill="#cfe9f5" font-family="ui-monospace,monospace" '
        'font-size="13">%d contributions on %d active days &#183; longest run %d</text>' % (total, days, run),
        '  <text x="494" y="34" fill="#5f849f" font-family="ui-monospace,monospace" '
        'font-size="12" text-anchor="end">last %s</text>' % (last or "n/a"),
        '</svg>',
    ]
    if gen:
        head.insert(-1, '  <text x="494" y="130" fill="#3c5a75" '
                        'font-family="ui-monospace,monospace" font-size="10" '
                        'text-anchor="end">drawn %s</text>' % gen[:16])
    return "\n".join(head) + "\n"


def main():
    login = sys.argv[1] if len(sys.argv) > 1 else None
    data = manifest()
    login = login or data.get("login") or "Alexander-Domanov"
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tape")
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"{login}.svg")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(draw(data, login))
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
