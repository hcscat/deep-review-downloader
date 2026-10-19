"""Inspect Git candidates without printing secret or personal matched values.

This is a focused pre-publication check, not a proof that all sensitive data is
absent. An independent secret scanner and manual content review complement it.
"""
from pathlib import Path
from hashlib import sha256
import argparse
import json
import re
import subprocess
import ipaddress
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TEXT_SUFFIXES = {'.ts', '.js', '.mjs', '.py', '.css', '.html', '.md', '.txt', '.json', '.yml', '.yaml', '.svg', '.toml'}


def candidate_paths() -> list[str]:
    """Use Git's ignore rules so profiles, dependencies and documents stay local."""
    result = subprocess.run(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=ROOT, check=True, capture_output=True)
    return sorted(set(p for p in result.stdout.decode('utf-8').split('\0') if p))


def scan(private_patterns: list[str]) -> dict:
    # Rules deliberately report only location/type, never the captured value.
    """Inspect publication candidates and report finding locations without exposing values."""
    rules = {
        'private-key': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
        'github-token': re.compile(r'(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})'),
        'cloud-key': re.compile(r'(?:AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|GOCSPX-[0-9A-Za-z_-]{20,})'),
        'jwt': re.compile(r'eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}'),
        'user-home-path': re.compile(r'(?:[A-Za-z]:[\\/]Users[\\/][^\s\\/"\']+|/(?:home|Users)/[^\s/"\']+)'),
        'absolute-machine-path': re.compile(r'(?i)(?<![a-z])[a-z]:[\\/](?:[^\s<>"\']+)'),
        'mac-address': re.compile(r'(?i)(?<![a-f0-9])(?:[a-f0-9]{2}[:-]){5}[a-f0-9]{2}(?![a-f0-9])'),
        'google-client-id': re.compile(r'[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com'),
        'analytics-id': re.compile(r'\b(?:G-[A-Z0-9]{10}|UA-[0-9]{4,}-[0-9]+)\b'),
        'real-document-id': re.compile(r'(?i)/(?:documents|reviews)/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}'),
        'email': re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'),
    }
    # Only explicitly configured public contact details may occur in store copy.
    settings = json.loads((ROOT / 'store/release-settings.json').read_text(encoding='utf-8'))
    contact = settings.get('publicContactEmail', '')
    allowed_contact_files = {'store/release-settings.json', 'store/privacy-policy.ko.html', 'docs/privacy-policy.html'}
    findings, records = [], []
    for name in candidate_paths():
        path = ROOT / name
        if not path.is_file():
            continue
        if path.is_symlink():
            findings.append({'path': name, 'rule': 'symlink-not-reviewed'})
            continue
        data = path.read_bytes()
        records.append({'path': name, 'bytes': len(data), 'sha256': sha256(data).hexdigest()})
        parts = Path(name).parts
        if any(part in ['node_modules', 'dist', 'output', 'private', 'snapshots'] for part in parts) or path.suffix.lower() in {'.zip', '.pdf', '.pem', '.key', '.p12', '.pfx'}:
            findings.append({'path': name, 'rule': 'forbidden-public-file'})
        if path.suffix.lower() == '.png':
            # Generated PNGs should contain pixels only; no EXIF or text payload.
            with Image.open(path) as image:
                if image.info or image.getexif():
                    findings.append({'path': name, 'rule': 'image-metadata'})
            continue
        if path.suffix.lower() not in TEXT_SUFFIXES and path.name not in ['.gitignore', '.gitattributes', '.prettierignore']:
            continue
        text = data.decode('utf-8')
        # Literal network addresses can identify the publisher's workstation or
        # network. Report only their location; never print an address value.
        for match in re.finditer(r'(?<![\w.])(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?![\w.])|(?<=\[)[0-9a-fA-F:]+(?=\])', text):
            try:
                address = ipaddress.ip_address(match.group())
            except ValueError:
                continue  # e.g. a four-part software version, not an IP address
            if address.is_loopback:
                continue  # explicit local-only test endpoints are not public IPs
            findings.append({'path': name, 'line': text.count('\n', 0, match.start()) + 1, 'rule': 'literal-ip-address'})
        for rule, pattern in rules.items():
            for match in pattern.finditer(text):
                # Third-party license attributions are preserved intentionally.
                if rule == 'email' and name in ['viewer/assets/GoogleSans-OFL.txt', 'viewer/assets/STIX-OFL.txt']:
                    continue
                if rule == 'email' and name in allowed_contact_files and match.group() == contact:
                    continue
                findings.append({'path': name, 'line': text.count('\n', 0, match.start()) + 1, 'rule': rule})
        # The user explicitly chose this public contact. Keep its exception
        # confined to policy/settings files, never to other source contents.
        sentinel_text = text.replace(contact, '[PUBLIC_CONTACT_EMAIL]') if name in allowed_contact_files and contact else text
        for sentinel in private_patterns:
            if sentinel and sentinel.casefold() in sentinel_text.casefold():
                findings.append({'path': name, 'rule': 'private-input-sentinel'})
    return {'success': not findings, 'candidateFiles': len(records), 'candidateBytes': sum(row['bytes'] for row in records), 'findings': findings, 'files': records,
            'scope': 'Git candidates, common secret/PII patterns, optional local private-input sentinels, PNG metadata. Pixel content requires visual review.',
            'intentionalDisclosures': ['User-selected repository URL', 'Third-party copyright/license attributions', 'Configured public publisher contact, when present']}


def main() -> None:
    """Load optional private sentinels and write an ignored local audit report."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--private-patterns', type=Path, help='Optional local JSON string list; never store this inside the repository')
    args = parser.parse_args()
    private_patterns = json.loads(args.private_patterns.read_text(encoding='utf-8')) if args.private_patterns else []
    report = scan(private_patterns)
    out = ROOT / 'output/public-source-audit.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({key: report[key] for key in ['success', 'candidateFiles', 'candidateBytes', 'findings']}))
    raise SystemExit(0 if report['success'] else 1)


if __name__ == '__main__':
    main()
