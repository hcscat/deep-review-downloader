"""Create original editable promo artwork; review screenshots are captured separately."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'store/assets'


def main() -> None:
    """Write original promotional SVG artwork and copy the generated extension icon."""
    DEST.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / 'dist/deep-review-extension/icons/128.png', DEST / 'icon-128.png')
    # Original vector artwork. No Google logo, manuscript or account data is used.
    small = '''<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280" viewBox="0 0 440 280">
<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#111c36"/><stop offset="1" stop-color="#193c68"/></linearGradient></defs>
<rect width="440" height="280" fill="url(#bg)"/>
<circle cx="430" cy="30" r="150" fill="#3079df" opacity=".1"/>
<rect x="26" y="25" width="28" height="28" rx="7" fill="#4285f4"/>
<path d="M40 31v12m-5-5 5 5 5-5m-13 7v3h16v-3" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<text x="65" y="37" fill="#dce9ff" font-family="Arial,sans-serif" font-size="11" font-weight="700" letter-spacing="1">DEEP REVIEW</text>
<text x="65" y="52" fill="#9fb8dc" font-family="Arial,sans-serif" font-size="10" letter-spacing="1.2">HTML EXPORTER</text>
<text x="26" y="108" fill="white" font-family="Arial,sans-serif" font-size="29" font-weight="700">Keep the review.</text>
<text x="26" y="147" fill="#96c4ff" font-family="Arial,sans-serif" font-size="29" font-weight="700">Take it offline.</text>
<rect x="294" y="173" width="119" height="80" rx="9" fill="#f7faff"/>
<rect x="306" y="184" width="45" height="58" rx="3" fill="white" stroke="#cad8ec"/>
<path d="M314 195h28m-28 7h28m-28 7h28m-28 7h28m-28 7h20" stroke="#9cb1cb" stroke-width="2"/>
<rect x="312" y="205" width="32" height="8" rx="1" fill="#f5ba4c" opacity=".6"/>
<rect x="361" y="184" width="40" height="23" rx="4" fill="#dcebff"/>
<path d="M367 191h27m-27 6h21" stroke="#5d8ac8" stroke-width="2"/>
<rect x="361" y="214" width="40" height="28" rx="4" fill="#e9eef7"/>
<path d="M367 222h27m-27 6h21m-21 6h24" stroke="#9cb1cb" stroke-width="2"/>
<path d="M343 209h9v-13h8" fill="none" stroke="#1a73e8" stroke-width="2"/>
<text x="26" y="216" fill="#d7e6ff" font-family="Arial,sans-serif" font-size="12">One HTML file.</text>
<text x="26" y="239" fill="#94acd1" font-family="Arial,sans-serif" font-size="11">Linked highlights and comments.</text>
</svg>'''
    large = '''<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="560" viewBox="0 0 1400 560">
<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#101b34"/><stop offset="1" stop-color="#1c4778"/></linearGradient></defs>
<rect width="1400" height="560" fill="url(#bg)"/>
<circle cx="1290" cy="75" r="410" fill="#477bd3" opacity=".1"/>
<text x="70" y="79" fill="#a9caff" font-family="Arial,sans-serif" font-size="15" font-weight="700" letter-spacing="2">DEEP REVIEW HTML EXPORTER</text>
<text x="66" y="192" fill="white" font-family="Arial,sans-serif" font-size="66" font-weight="700">Your review,</text>
<text x="66" y="270" fill="#99c8ff" font-family="Arial,sans-serif" font-size="66" font-weight="700">ready offline.</text>
<text x="70" y="331" fill="#d6e5fb" font-family="Arial,sans-serif" font-size="22">Linked highlights. Complete feedback.</text>
<text x="70" y="365" fill="#d6e5fb" font-family="Arial,sans-serif" font-size="22">One HTML file.</text>
<g font-family="Arial,sans-serif" font-size="13" font-weight="700" text-anchor="middle">
<rect x="70" y="425" width="132" height="40" rx="20" fill="#2b4a73"/><text x="136" y="450" fill="#e1edff">ONE CLICK</text>
<rect x="214" y="425" width="150" height="40" rx="20" fill="#2b4a73"/><text x="289" y="450" fill="#e1edff">NO UPLOADS</text>
<rect x="376" y="425" width="132" height="40" rx="20" fill="#2b4a73"/><text x="442" y="450" fill="#e1edff">OFFLINE</text></g>
<rect x="762" y="70" width="568" height="420" rx="20" fill="#f4f8ff"/>
<rect x="785" y="94" width="267" height="370" rx="7" fill="white" stroke="#cedaeb"/>
<rect x="808" y="120" width="219" height="15" rx="4" fill="#2b5c9c"/>
<path d="M808 159h219m-219 13h219m-219 13h160m-160 40h219m-219 13h219m-219 13h219m-219 13h200m-200 40h219m-219 13h219m-219 13h185m-185 40h219m-219 13h219m-219 13h160" stroke="#bccbdd" stroke-width="5" stroke-linecap="round"/>
<rect x="804" y="232" width="227" height="24" rx="3" fill="#f1bd55" opacity=".55"/>
<rect x="1076" y="94" width="229" height="128" rx="12" fill="#e9f1ff" stroke="#cfdef4"/>
<text x="1095" y="123" fill="#295c9c" font-family="Arial,sans-serif" font-size="14" font-weight="700">OVERALL FEEDBACK</text>
<path d="M1095 147h188m-188 14h188m-188 14h167m-167 14h180" stroke="#91add1" stroke-width="5" stroke-linecap="round"/>
<rect x="1076" y="241" width="229" height="137" rx="12" fill="white" stroke="#6b9ce0" stroke-width="2"/>
<rect x="1095" y="259" width="53" height="19" rx="4" fill="#fff0c7"/>
<path d="M1095 298h185m-185 14h185m-185 14h165m-165 14h180m-180 14h150" stroke="#9aafcb" stroke-width="5" stroke-linecap="round"/>
<rect x="1076" y="396" width="229" height="68" rx="12" fill="#edf2fa"/>
<path d="M1095 419h185m-185 14h160m-160 14h180" stroke="#adbed5" stroke-width="5" stroke-linecap="round"/>
<path d="M1028 244h28v47h19" fill="none" stroke="#4285f4" stroke-width="3"/>
</svg>'''
    (DEST / 'promo-small.svg').write_text(small, encoding='utf-8')
    (DEST / 'promo-marquee.svg').write_text(large, encoding='utf-8')
    print('Prepared editable 440x280 and 1400x560 promo artwork and 128px icon.')


if __name__ == '__main__':
    main()
