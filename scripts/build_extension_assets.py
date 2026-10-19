"""Build portable presentation assets without reading any user review."""
from pathlib import Path
import sys
from PIL import Image, ImageDraw
from assets import font_css, font_notices

ROOT = Path(__file__).resolve().parents[1]


def build(out: Path) -> None:
    # Only authored styles and cached, licensed fonts enter the extension.
    """Write authored viewer styles, font notices and generated icons to the build folder."""
    css = '\n'.join([font_css(), (ROOT / 'viewer/base.css').read_text(encoding='utf-8'),
                     (ROOT / 'viewer/viewer.css').read_text(encoding='utf-8')])
    out.mkdir(parents=True, exist_ok=True)
    (out / 'viewer.css').write_text(css, encoding='utf-8')
    (out / 'THIRD_PARTY_NOTICES.txt').write_text(font_notices(), encoding='utf-8')
    (out / 'icons').mkdir(exist_ok=True)
    for size in (16, 32, 48, 128):
        # Supersampling keeps the small toolbar icons crisp.
        scale = 4
        image = Image.new('RGBA', (size * scale, size * scale))
        draw = ImageDraw.Draw(image)
        canvas = size * scale
        # 16px padding around a 96px square at the store's 128px icon size.
        padding = canvas * .125
        edge = canvas - 2 * padding
        point = lambda x, y: (padding + edge * x, padding + edge * y)
        draw.rounded_rectangle((*point(0, 0), *point(1, 1)), radius=edge * .22, fill='#1a73e8')
        stroke = max(2, int(edge * .065))
        draw.line([point(.5, .2), point(.5, .59)], fill='white', width=stroke)
        draw.line([point(.32, .44), point(.5, .62), point(.68, .44)], fill='white', width=stroke, joint='curve')
        draw.line([point(.23, .66), point(.23, .79), point(.77, .79), point(.77, .66)], fill='white', width=stroke, joint='curve')
        image.resize((size, size), Image.Resampling.LANCZOS).save(out / 'icons' / f'{size}.png')
    print('Prepared standalone styles, font notices and extension icons.')


if __name__ == '__main__':
    build(Path(sys.argv[1]))
