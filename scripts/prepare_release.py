"""Prepare local GitHub release assets, without Git or remote write operations."""
from pathlib import Path
from hashlib import sha256
from zipfile import ZipFile
import json
import shutil

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    """Check the built package and create a local versioned ZIP with matching checksums."""
    manifest = json.loads((ROOT / 'dist/deep-review-extension/manifest.json').read_text(encoding='utf-8'))
    package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
    version = manifest['version']
    assert version == package['version'], 'Package and extension versions differ'
    assert manifest['permissions'] == ['activeTab', 'scripting', 'downloads']
    assert not manifest.get('host_permissions'), 'Production must use activeTab'
    # Publish only the build's explicit ZIP, never a development/profile folder.
    source = ROOT / 'dist/deep-review-extension.zip'
    with ZipFile(source) as archive:
        assert 'manifest.json' in archive.namelist()
        assert json.loads(archive.read('manifest.json')) == manifest
        for name in archive.namelist():
            assert not name.startswith(('/', '\\')) and '..' not in Path(name).parts
            assert archive.read(name) == (ROOT / 'dist/deep-review-extension' / name).read_bytes()
    destination = ROOT / 'dist/release'
    destination.mkdir(parents=True, exist_ok=True)
    target = destination / f'deep-review-html-exporter-v{version}.zip'
    shutil.copyfile(source, target)
    digest = sha256(target.read_bytes()).hexdigest()
    # The public checksum records a filename only, not the builder's local path.
    (destination / 'SHA256SUMS.txt').write_text(f'{digest}  {target.name}\n', encoding='utf-8', newline='\n')
    print(json.dumps({'version': version, 'archive': target.relative_to(ROOT).as_posix(), 'sha256': digest, 'publication': 'local preparation only'}))


if __name__ == '__main__':
    main()
