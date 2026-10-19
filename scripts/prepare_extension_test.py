"""Prepare a separate test extension, fictional reviews and an isolated Chrome profile."""
from pathlib import Path
import json,shutil,subprocess
from generate_demo_fixtures import main as generate_fixtures

ROOT=Path(__file__).resolve().parents[1]
# Every generated profile/download stays in ignored output, never the user's Chrome data.
base=ROOT/'output/playwright'
test_extension=base/'extension-test'
shutil.copytree(ROOT/'dist/deep-review-extension',test_extension,dirs_exist_ok=True)
manifest=json.loads((test_extension/'manifest.json').read_text(encoding='utf-8'))
# Only the test copy receives this narrowly scoped fixture-origin permission.
# It lets automation call the same action handler without a physical toolbar click.
manifest['host_permissions']=['https://research.google/*']
(test_extension/'manifest.json').write_text(json.dumps(manifest),encoding='utf-8')
# A failed probe build must not leave an older successful probe available.
probe=(test_extension/'security-probe.js').resolve()
assert probe.is_relative_to((ROOT/'output/playwright').resolve())
probe.unlink(missing_ok=True)
subprocess.run(['node', 'scripts/build_security_probe.mjs'], cwd=ROOT, check=True)
generate_fixtures()
profile=base/'extension-profile'
(profile/'Default').mkdir(parents=True,exist_ok=True)
downloads=(base/'extension-downloads').resolve();downloads.mkdir(exist_ok=True)
# Accept synthetic downloads without opening a Save dialog in automated tests.
(profile/'Default/Preferences').write_text(json.dumps({'download':{'default_directory':str(downloads),'prompt_for_download':False,'directory_upgrade':True}}),encoding='utf-8')
config={'browser':{'browserName':'chromium','isolated':False,'userDataDir':str(profile.resolve()),'launchOptions':{'channel':'chromium','headless':True,'ignoreDefaultArgs':['--disable-extensions'],'args':[f'--disable-extensions-except={test_extension.resolve()}',f'--load-extension={test_extension.resolve()}'],'downloadsPath':str(downloads)},'contextOptions':{'viewport':{'width':1440,'height':1000},'acceptDownloads':True,'reducedMotion':'reduce'}},'allowUnrestrictedFileAccess':True,'snapshot':{'mode':'none'},'timeouts':{'action':10000}}
(ROOT/'.playwright/extension.config.json').write_text(json.dumps(config,indent=2),encoding='utf-8')
print('Prepared isolated synthetic fixtures and test-only origin permission.')
