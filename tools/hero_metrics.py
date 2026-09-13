#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Замер читаемости mobile hero на us812.ru (локальная версия index.html).

Считает по РЕАЛЬНЫМ пикселям скриншота секции #hero:
  * насколько тёмный фон и насколько в нём читается изделие;
  * контраст каждого текстового элемента с фоном под ним (наихудший случай
    и медиана) — то есть не «по цвету из CSS», а по тому, что видно на экране.

Зачем: яркость фона hero и читаемость текста связаны. Правится это двумя
ручками в css/style.css (см. HERO-TUNING.md). Этот скрипт нужен, чтобы
крутить их по числам, а не на глаз, и не уронить контраст ниже WCAG AA.

Запуск из корня проекта:
    python tools/hero_metrics.py            # текущее состояние CSS -> "new"
    python tools/hero_metrics.py --baseline --new   # сравнить с прежними значениями
    python tools/hero_metrics.py --widths 375 390   # только нужные ширины

Режим --baseline НЕ трогает файлы и git: он подменяет прежние значения
mobile-оверлея инъекцией CSS в браузере, поэтому сравнение честное и
без откатов.

Зависимости: playwright (системный Chrome), Pillow, numpy.
    pip install playwright pillow numpy
"""
import argparse
import json
import pathlib
import sys

from PIL import Image
import numpy as np
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / "index.html").as_uri()
OUT_DIR = pathlib.Path(__file__).resolve().parent / "out"

# Прежние значения mobile-оверлея (до Task02, 13.09.2026). Нужны для режима
# --baseline: сравнить «как было» с «как стало», не откатывая правки.
BASELINE_MOBILE_CSS = """
@media (max-width: 767px) {
    .hero__bg::after {
        background: linear-gradient(180deg,
            rgba(10,10,10,0.95) 0%, rgba(10,10,10,0.88) 45%, rgba(10,10,10,0.95) 100%) !important;
    }
    .hero__bg img { filter: none !important; }
}
"""

DEFAULT_WIDTHS = [(320, 700), (375, 812), (390, 844), (430, 932), (1280, 900)]

# Текстовые элементы hero, которые обязаны оставаться читаемыми.
TEXT_ELEMENTS = {
    "h1": ".hero__title",
    "price": ".hero__price",
    "subtitle": ".hero__subtitle",
    "geo": ".hero__geo",
}

# WCAG AA для обычного текста — 4.5:1, для крупного (H1) — 3:1.
WCAG_AA = 4.5


def _rel_lum(c):
    """Линейная яркость по относительной колориметрии sRGB (спецификация WCAG)."""
    def chan(v):
        v = v / 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * chan(c[0]) + 0.7152 * chan(c[1]) + 0.0722 * chan(c[2])


def contrast(fg, bg):
    l1, l2 = _rel_lum(fg), _rel_lum(bg)
    if l1 < l2:
        l1, l2 = l2, l1
    return round((l1 + 0.05) / (l2 + 0.05), 2)


def background_stats(image_path):
    """Характеристики фона hero на скриншоте.

    Берутся только тёмные пиксели (средний канал < 60): это именно фон, без
    букв и без бликов самого изделия. Иначе цифры врал бы текст.
      * bgMean — насколько фон осветлён (0..255);
      * bgStd  — разброс яркости внутри фона. РАСТЁТ = изделие различимо.
        Именно этот показатель отвечает за «видно, что на фоне печатка».
    """
    a = np.asarray(Image.open(image_path).convert("RGB"), dtype=np.float32)
    gray = a.mean(axis=2)
    bg = gray[gray < 60]
    gy, gx = np.gradient(gray)
    return {
        "bgMean": round(float(bg.mean()), 2),
        "bgStd": round(float(bg.std()), 2),
        "edgeEnergy": round(float(np.hypot(gx, gy).mean()), 2),
    }


def text_contrast(image_path, box, text_rgb):
    """Контраст текста с фоном непосредственно под ним.

    Внутри прямоугольника текста остаётся только тёмный фон; из него:
      * worst    — самый светлый пиксель (пессимистичная оценка);
      * medianBg — медианный (типичная картина).
    Оба должны быть выше WCAG AA, иначе часть букв тонет в светлых участках.
    """
    a = np.asarray(Image.open(image_path).convert("RGB"), dtype=np.float32)
    x0, y0, x1, y1 = [int(v) for v in box]
    crop = a[max(0, y0):y1, max(0, x0):x1].reshape(-1, 3)
    if crop.size == 0:
        return None
    bg = crop[crop.mean(axis=1) < 60]
    if bg.size == 0:
        return None
    worst = [int(v) for v in bg[int(np.argmax(bg.mean(axis=1)))]]
    median = [int(np.median(bg[:, i])) for i in range(3)]
    return {
        "worst": contrast(text_rgb, worst),
        "median": contrast(text_rgb, median),
        "worstBgPixel": worst,
    }


def collect(page):
    """Геометрия и цвета текстовых элементов hero + фактические значения ручек."""
    return page.evaluate(
        """(elems) => {
            const hb = document.querySelector('#hero').getBoundingClientRect();
            const rel = (sel) => {
                const r = document.querySelector(sel).getBoundingClientRect();
                return [r.left - hb.left, r.top - hb.top, r.right - hb.left, r.bottom - hb.top];
            };
            const rgb = (sel) => getComputedStyle(document.querySelector(sel)).color
                .match(/\\d+/g).map(Number).slice(0, 3);
            const out = {
                heroHeight: Math.round(hb.height),
                overlay: getComputedStyle(document.querySelector('.hero__bg'), '::after').backgroundImage,
                imgFilter: getComputedStyle(document.querySelector('.hero__bg img')).filter
            };
            for (const [name, sel] of Object.entries(elems)) {
                out[name] = {box: rel(sel), color: rgb(sel)};
            }
            return out;
        }""",
        TEXT_ELEMENTS,
    )


def measure(mode, widths):
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        for w, h in widths:
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
            page = ctx.new_page()
            # Метрику не трогаем: иначе в счётчик утекут тестовые pageview.
            page.add_init_script("window.ym = function(){};")
            page.goto(PAGE, wait_until="load")
            if mode == "baseline":
                page.add_style_tag(content=BASELINE_MOBILE_CSS)
            page.wait_for_timeout(900)  # дождаться прогона анимаций появления
            shot = OUT_DIR / f"hero_{mode}_{w}.png"
            page.locator("#hero").screenshot(path=str(shot))
            geo = collect(page)

            rec = {
                "heroHeight": geo["heroHeight"],
                "overlay": geo["overlay"],
                "imgFilter": geo["imgFilter"],
            }
            rec.update(background_stats(shot))
            for name in TEXT_ELEMENTS:
                rec[name] = text_contrast(shot, geo[name]["box"], geo[name]["color"])
            results[str(w)] = rec
            ctx.close()
        browser.close()
    return results


def print_table(res, ref=None, label=""):
    # 18 символов — чтобы влезло «10.55/18.29(+1.41)» и колонки не слипались.
    cols = "  ".join(f"{n:>18}" for n in TEXT_ELEMENTS)
    print(f"\n{'width':>6} {'heroH':>6} {'bgMean':>7} {'bgStd':>7}  {cols}")
    for w, v in res.items():
        row = f"{w:>6} {v['heroHeight']:>6} {v['bgMean']:>7} {v['bgStd']:>7}"
        for name in TEXT_ELEMENTS:
            t = v[name]
            if not t:
                row += f"{'-':>18}"
                continue
            cell = f"{t['worst']}/{t['median']}"
            if ref and ref.get(w, {}).get(name):
                cell += f"({t['worst'] - ref[w][name]['worst']:+.2f})"
            row += f"{cell:>18}"
        print(row)

    # Вердикт — только по мобильным ширинам: desktop-оверлей этими ручками
    # не регулируется, и его цифры не должны влиять на вывод.
    mobile = {w: v for w, v in res.items() if int(w) < 768} or res
    worst = min(
        (v[n]["worst"] for v in mobile.values() for n in TEXT_ELEMENTS if v[n]),
        default=None,
    )
    measured = sum(1 for v in res.values() for n in TEXT_ELEMENTS if v[n])
    if measured == 0:
        print("\n!!! НИЧЕГО не измерилось: селекторы TEXT_ELEMENTS не находятся на странице.")
        return
    scope = "мобильные ширины" if len(mobile) < len(res) else "все ширины"
    tag = f"[{label}] " if label else ""
    print(f"\n{tag}Худший контраст текста ({scope}): {worst}:1   (WCAG AA = {WCAG_AA}:1)")
    if worst is None:
        print("НЕ ПОНЯТНО: контраст не измерился — проверьте селекторы.")
    elif worst < WCAG_AA:
        print(f"!!! НИЖЕ WCAG AA: фон слишком светлый"
              f"{' (так было раньше — текущая правка это исправила)' if label == 'BASELINE' else ' — откатывать ручки'}.")
    elif worst < WCAG_AA * 1.3:
        print("! Запас над WCAG AA небольшой — дальше осветлять осторожно.")
    else:
        print("OK: запас над WCAG AA есть.")


def main():
    ap = argparse.ArgumentParser(description="Замер читаемости mobile hero")
    ap.add_argument("--baseline", action="store_true",
                    help="замереть ПРЕЖНИЕ значения оверлея (инъекцией CSS, файлы не трогаются)")
    ap.add_argument("--new", action="store_true",
                    help="замереть текущее состояние CSS")
    ap.add_argument("--widths", nargs="+", type=int, default=None,
                    help="ширины вьюпорта (высота подбирается типовая)")
    args = ap.parse_args()

    heights = {320: 700, 375: 812, 390: 844, 430: 932, 768: 900,
               1024: 900, 1280: 900, 1440: 900, 1920: 1080}
    if args.widths:
        widths = [(w, heights.get(w, 900)) for w in args.widths]
    else:
        widths = DEFAULT_WIDTHS

    OUT_DIR.mkdir(exist_ok=True)

    if not args.baseline and not args.new:
        args.new = True

    res_new = measure("new", widths) if args.new else None
    res_base = measure("baseline", widths) if args.baseline else None

    if res_base:
        print("\n=== BASELINE (прежние значения оверлея) ===")
        print_table(res_base, label="BASELINE")
    if res_new:
        print("\n=== " + ("NEW (текущий CSS)" if res_base else "ТЕКУЩИЙ CSS") + " ===")
        print_table(res_new, ref=res_base, label="NEW")

    (OUT_DIR / "hero_metrics.json").write_text(
        json.dumps({"new": res_new, "baseline": res_base}, ensure_ascii=False, indent=1),
        encoding="utf-8")
    print(f"\nСкриншоты и json: {OUT_DIR.relative_to(ROOT)}"
          f"\nСправка по ручкам: HERO-TUNING.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
