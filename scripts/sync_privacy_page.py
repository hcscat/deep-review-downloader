"""Copy the approved policy to a static GitHub Pages source; never publish it."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    """Check the approved public identity and synchronize the local policy copy."""
    settings = json.loads((ROOT / 'store/release-settings.json').read_text(encoding='utf-8'))
    text = (ROOT / 'store/privacy-policy.ko.html').read_text(encoding='utf-8')
    for key in ['publisherName', 'publicContactEmail']:
        assert settings[key] and not settings[key].startswith('['), f'Public {key} must be explicitly set'
        assert settings[key] in text, f'Policy does not match {key}'
    assert '[PUBLISHER_NAME]' not in text and '[PUBLIC_CONTACT_EMAIL]' not in text
    # Fixed LF also keeps the tracked copy byte-identical on Windows.
    (ROOT / 'docs/privacy-policy.html').write_text(text, encoding='utf-8', newline='\n')
    print('Synchronized the local static policy. No page was uploaded or deployed.')


if __name__ == '__main__':
    main()
