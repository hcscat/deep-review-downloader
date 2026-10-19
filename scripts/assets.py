"""Shared, offline-only embedding of the licensed viewer fonts."""
from pathlib import Path
import base64

ROOT = Path(__file__).resolve().parents[1]


def data_url(path: Path, mime: str) -> str:
    """Embed a known local asset; no URL or user credential is resolved here."""
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def font_css() -> str:
    # Subsets prevent Latin, accented Latin and Greek from competing for glyphs.
    """Embed cached Latin, Greek and math fonts as offline-only CSS font faces."""
    assets = ROOT / "viewer/assets"
    ranges = {
        "latin": "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
        "latin-ext": "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF",
        "greek": "U+0370-03FF",
    }
    rules = []
    for subset, unicode_range in ranges.items():
        url = data_url(assets / f"google-sans-{subset}.woff2", "font/woff2")
        rules.append("@font-face{font-family:'Google Sans';font-style:normal;font-weight:100 900;"
                     f"src:url({url}) format('woff2');font-display:swap;unicode-range:{unicode_range};}}")
    url = data_url(assets / "STIXTwoMath-Regular.ttf", "font/ttf")
    rules.append("@font-face{font-family:'STIXTwoMath-Regular';"
                 f"src:url({url}) format('truetype');font-weight:400;font-display:swap;}}")
    return "\n".join(rules)


def font_notices() -> str:
    """Carry both font licenses into packages and exported HTML documents."""
    return "\n\n".join((ROOT / "viewer/assets" / name).read_text(encoding="utf-8")
                        for name in ("GoogleSans-OFL.txt", "STIX-OFL.txt"))
