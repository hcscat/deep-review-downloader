# 개발과 검증

## 빌드 경계

`npm run typecheck` 후 `npm run build`를 실행합니다. 빌드는 `viewer/base.css`와 공통 동작·글꼴을 묶어 `dist/`에 설치 폴더와 ZIP을 생성합니다. ZIP은 고정된 파일 목록으로 만들어 원본 자료·임시 파일을 포함하지 않습니다. 설치 산출물에 필요한 개발 도구나 Python 런타임은 없습니다.

`capture.ts`는 격리된 content script이므로 IIFE로, 작업 페이지와 서비스 워커는 ES module로 묶습니다. 전송할 전체 JSON은 길이와 SHA-256을 대조하고 256Ki 문자 청크마다 순서와 ACK를 확인합니다. 문자열 길이 상한은 160Mi 문자이며 UTF-8 바이트 수와 같지 않습니다.

## 가상 문서로 통합 검사

개인 Chrome 프로필이나 실제 Google 계정은 사용하지 않습니다. 아래 명령은 저장소 루트에서 실행합니다.

```powershell
python scripts/prepare_extension_test.py
npx --yes --package @playwright/cli playwright-cli install-browser chromium
npx --yes --package @playwright/cli playwright-cli -s=export-check open about:blank --config .playwright/extension.config.json
npx --yes --package @playwright/cli playwright-cli -s=export-check run-code --filename scripts/verify_extension.js | Tee-Object -FilePath output/playwright/extension-verification-log.txt
python scripts/collect_extension_results.py
npx --yes --package @playwright/cli playwright-cli -s=export-check close
```

`collect_extension_results.py`는 브라우저를 닫기 전에 실행하세요. 자동화가 수락한 다운로드 파일은 컨텍스트 종료 시 삭제될 수 있으므로, 먼저 `output/playwright/exported-demo-one.html` 등에 복사해 검증합니다.

준비 스크립트는 **테스트 복사본**에만 fixture origin의 host 권한을 추가합니다. Google URL은 로컬 가상 문서로 응답하며 네트워크에서 Google 리뷰를 가져오지 않습니다. 배포 매니페스트에는 host 권한이 없습니다. 물리적 툴바 클릭에 의한 activeTab 권한 부여와 로그인된 실제 Google 앱의 DOM은 별도 실제 사용 확인 범위입니다.

필터·Report 상태 복원, 모든 코멘트와 하이라이트의 수집, 실제 Chrome 다운로드 API, 연결 누락·지원하지 않는 페이지의 오류를 검사합니다. 가상 문서의 UI 제어는 작은 자체 스크립트로 모사하며 Google 앱 코드는 실행하지 않습니다.

## 오프라인 파일 검사

앞서 받은 `exported-demo-one.html`의 절대 file URL을 사용합니다.

```powershell
npx --yes --package @playwright/cli playwright-cli -s=viewer-check open '<absolute-file-url>' --config .playwright/cli.config.json
npx --yes --package @playwright/cli playwright-cli -s=viewer-check run-code --filename scripts/verify_viewer.js
npx --yes --package @playwright/cli playwright-cli -s=viewer-check close
```

12개 동작 그룹에서 오프라인 자원, 펼침·전환, 카드·하이라이트의 양방향 이동과 포커스, 필터·숨김 복원, 50/100/200/500% 좌표, 보고서 복사 내용, 넓고 좁은 화면, 외부 요청과 오류를 검사합니다. 클립보드 API는 테스트에서 대체하므로 OS 클립보드는 바꾸지 않습니다.

`npm run format:check`는 주석을 포함한 TS/JS/CSS 형식을 검사합니다. 주요 변수의 역할·수명, 비동기 취소와 복원 경계, 백분율 좌표와 확대 기준점을 설명하는 주석을 변경할 때도 유지하세요.

## 공식 자료

- [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [메시지 전달](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [Downloads API](https://developer.chrome.com/docs/extensions/reference/api/downloads)
- [Playwright 확장 테스트](https://playwright.dev/docs/chrome-extensions)

## Security, localization and GitHub release tests

After the extension test, while the same browser is open:

```powershell
npx --yes --package @playwright/cli playwright-cli -s=export-check run-code --filename scripts/verify_security.js
```

Run the security suite in another isolated profile with `--lang=en-US` to check English alongside Korean. `prepare_extension_test.py` adds a security probe only to the test copy; the production ZIP excludes it. The viewer suite now has 13 groups, including both interface languages and unchanged review text.

Create `docs/images/`, open the generated fictional `exported-demo-one.html`, and run `scripts/capture_readme_screenshots.js` to update the four README screenshots. `python scripts/verify_store_assets.py` checks both README and earlier store artwork. Real documents must never be used for public screenshots.

`npm run release:prepare` builds local versioned ZIP/checksum assets only. See [GitHub release steps](releasing.md).
