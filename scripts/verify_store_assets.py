"""Check store image dimensions, pixel metadata and editable artwork references."""
from pathlib import Path
from hashlib import sha256
import json
import re
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {
    'icon-128.png': (128, 128),
    'screenshot-01-overview.png': (1280, 800),
    'screenshot-02-linked-feedback.png': (1280, 800),
    'screenshot-03-report.png': (1280, 800),
    'screenshot-04-zoom.png': (1280, 800),
    'promo-small.png': (440, 280),
    'promo-marquee.png': (1400, 560),
}


def main() -> None:
    """Validate screenshot/artwork sizes, pixel metadata and safe SVG references."""
    records = []
    for name, expected in EXPECTED.items():
        path = ROOT / 'store/assets' / name
        with Image.open(path) as image:
            assert image.format == 'PNG' and image.size == expected, f'Wrong store format: {name}'
            assert image.mode in ['RGB', 'RGBA'], f'Unexpected color mode: {name}'
            assert not image.info and not image.getexif(), f'Unexpected metadata: {name}'
            assert len(image.convert('RGB').getcolors(maxcolors=2) or []) != 1, f'Blank artwork: {name}'
            if name == 'icon-128.png':
                assert image.mode == 'RGBA' and image.getpixel((0, 0))[3] == 0, 'Icon padding must be transparent'
        data = path.read_bytes()
        records.append({'path': f'store/assets/{name}', 'size': expected, 'bytes': len(data), 'sha256': sha256(data).hexdigest(), 'metadataFree': True})
    for path in (ROOT / 'store/assets').glob('*.svg'):
        text = path.read_text(encoding='utf-8')
        assert not re.search(r'(?:href|src)\s*=|<script|<foreignObject', text, re.I), 'SVG contains an external or active resource'
    for path in (ROOT / 'docs/images').glob('*.png'):
        with Image.open(path) as image:
            assert image.size == (1440, 960) and not image.info and not image.getexif(), f'Invalid README screenshot: {path.name}'
        records.append({'path': path.relative_to(ROOT).as_posix(), 'size': (1440, 960), 'sha256': sha256(path.read_bytes()).hexdigest(), 'metadataFree': True})
    report = {'success': True, 'assets': records, 'provenance': 'Screenshots of actual extension output from original fictional fixtures; promotional vectors authored by this project.', 'visualReviewRequired': True}
    output = ROOT / 'output/store-assets-verification.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'success': True, 'pngAssets': len(records), 'metadataFree': True}))


if __name__ == '__main__':
    main()
