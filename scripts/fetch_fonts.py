"""Cache the snapshot's public web fonts; the generated viewer never fetches them."""
from pathlib import Path
from hashlib import sha256
import json
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "viewer" / "assets"
BASE = "https://fonts.gstatic.com/s/googlesans/v62/"
PREFIX = "4UaRrENHsxJlGDuGo1OIlJfC6l_24rlCK1Yo_Iq2"
# Public upstream font/license locations; no document URLs or credentials are used.
FONTS = {
    "google-sans-latin.woff2": BASE + PREFIX + "vgCI.woff2",
    "google-sans-latin-ext.woff2": BASE + PREFIX + "sACIlsw.woff2",
    "google-sans-greek.woff2": BASE + PREFIX + "vQCIlsw.woff2",
    "STIXTwoMath-Regular.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/stixtwomath/STIXTwoMath-Regular.ttf",
    "GoogleSans-OFL.txt": "https://raw.githubusercontent.com/google/fonts/main/ofl/googlesans/OFL.txt",
    "STIX-OFL.txt": "https://raw.githubusercontent.com/google/fonts/main/ofl/stixtwomath/OFL.txt",
}


def main():
    """Fetch missing public font/license assets and record their source URLs and hashes."""
    DEST.mkdir(parents=True, exist_ok=True)
    records = []
    for name, url in FONTS.items():
        target = DEST / name
        if not target.exists():
            request = Request(url, headers={"User-Agent": "DeepReviewOfflineBuilder/1.0"})
            with urlopen(request, timeout=30) as response:
                data = response.read()
            if name.endswith(".woff2") and data[:4] != b"wOF2":
                raise ValueError(f"Invalid WOFF2: {name}")
            if name.endswith(".ttf") and data[:4] not in (b"\x00\x01\x00\x00", b"OTTO"):
                raise ValueError(f"Invalid font: {name}")
            target.write_bytes(data)
        data = target.read_bytes()
        records.append({"file": name, "source": url, "bytes": len(data), "sha256": sha256(data).hexdigest()})
        print(f"{name}: {len(data):,} bytes")
    (DEST / "sources.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
