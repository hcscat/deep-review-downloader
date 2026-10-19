"""Preserve accepted test downloads before Playwright closes its context."""
from pathlib import Path
from hashlib import sha256
from zipfile import ZipFile
import json,re
from bs4 import BeautifulSoup

r=Path(__file__).resolve().parents[1]
log=r/'output/playwright/extension-verification-log.txt'
report=json.loads(next(line for line in log.read_text(encoding='utf-8-sig').splitlines() if line.startswith('{"success":')))
assert report['success']
# Save accepted downloads before closing the automation context removes them.
for item in report['exports']:
    source=Path(item['filename']).resolve()
    assert source.is_relative_to((r/'output/playwright/extension-downloads').resolve())
    data=source.read_bytes()
    target=r/f"output/playwright/exported-{item['name']}.html"
    target.write_bytes(data)
    # The fixture is the source of truth for body text, page pixels and link counts.
    original=BeautifulSoup((r/item['path']).read_bytes(),'lxml')
    saved=BeautifulSoup(data,'lxml')
    def texts(soup):
        """Compare visible comment bodies by their stable IDs, ignoring whitespace differences."""
        return {el['data-margin-card-id']:re.sub(r'\s+',' ',el.select_one('.comment-body').get_text()).strip() for el in soup.select('[data-margin-card-id]')}
    assert texts(original)==texts(saved),f"Comment text changed: {item['name']}"
    assert len(saved.select('[data-pdf-page-wrapper]'))==item['pages']
    assert len(saved.select('.pdf-bbox-highlight'))==item['highlights']
    assert [el['src'] for el in original.select('.annotated-pdf-page-img')]==[el['src'] for el in saved.select('.annotated-pdf-page-img')]
    assert all(el.get('src','').startswith('data:') for el in saved.select('[src]'))
    assert not saved.select('script[src],link[rel=stylesheet],.deepreview-header,.landing-link,#offline-version,.review-feedback-btn')
    item.update({'copiedArtifact':target.relative_to(r).as_posix(),'sha256':sha256(data).hexdigest(),'commentTextVerified':True,'pageImagesVerified':True,'singleFileResourcesVerified':True})
# Inspect the production manifest, not the test copy with fixture-only host access.
manifest=json.loads((r/'dist/deep-review-extension/manifest.json').read_text(encoding='utf-8'))
assert manifest['permissions']==['activeTab','scripting','downloads'] and not manifest.get('host_permissions')
with ZipFile(r/'dist/deep-review-extension.zip') as z:
    assert json.loads(z.read('manifest.json'))==manifest
report['productionPermissions']=manifest['permissions']
report['productionHasHostPermissions']=False
(r/'output/playwright/extension-verification.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'success':True,'verified':[{'name':e['name'],'pages':e['pages'],'comments':e['comments'],'highlights':e['highlights'],'commentTextVerified':True} for e in report['exports']]}))
