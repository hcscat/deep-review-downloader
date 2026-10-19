> **On hold:** Web Store submission is deferred. These are earlier reference materials. Current distribution is GitHub Releases only; see `docs/releasing.md`.

# 웹스토어 등록 자료

대상은 확장 1.0.1입니다. 파일은 준비본이며 GitHub 업로드·정책 웹페이지 게시·웹스토어 제출은 수행하지 않습니다.

| 파일 | 등록 용도 |
|---|---|
| `listing.ko.txt`, `listing.en.txt` | 스토어 소개 문구 |
| `permissions.ko.txt` | 단일 목적·권한·원격 코드·데이터 처리 설명 |
| `privacy-policy.ko.html` | 게시할 개인정보처리방침 HTML |
| `reviewer-instructions.en.txt` | 심사자가 재현할 테스트 방법 |
| `release-settings.json` | 게시자·공개 문의·정책 예정 주소·심사용 샘플 URL |
| `assets/icon-128.png` | 128×128 아이콘 |
| `assets/screenshot-01-overview.png` | 전체 피드백, 1280×800 |
| `assets/screenshot-02-linked-feedback.png` | 하이라이트·코멘트 연결, 1280×800 |
| `assets/screenshot-03-report.png` | Report 보기, 1280×800 |
| `assets/screenshot-04-zoom.png` | 확대된 논문과 코멘트, 1280×800 |
| `assets/promo-small.png` | 필수 홍보 이미지, 440×280 |
| `assets/promo-marquee.png` | 선택 홍보 이미지, 1400×560 |
| `assets/promo-*.svg` | 편집 가능한 자체 홍보 이미지 원본 |

## 내용과 개인정보

스크린샷은 가상 문서가 실제 확장 수집·렌더링·다운로드를 거친 HTML을 촬영합니다. 가상 논문과 코멘트는 `scripts/generate_demo_fixtures.py`가 직접 만듭니다. 실제 논문·저자·계정·리뷰 ID·이메일·사용자 PC 경로는 이미지에 넣지 않습니다. 홍보 이미지는 별도의 자체 벡터 그림이며 Google 로고를 사용하지 않습니다. PNG의 EXIF·텍스트 메타데이터도 검사합니다.

## 게시 전에 채울 값

사용자가 지정한 게시자명과 공개 문의 이메일은 `release-settings.json` 및 개인정보처리방침에 반영했습니다. 해당 연락처는 의도적인 공개 정보이며 자동으로 개인 Git 설정에서 추출한 값이 아닙니다. 정책 URL은 GitHub Pages용 예정 주소로 설정했지만 아직 공개하지 않았습니다. `docs/privacy-publication.md`에 따라 게시한 뒤 로그인 없이 열리는지 확인하고 웹스토어에 등록하세요. 정책의 시행은 1.0.1 공개일부터입니다.

심사용 `[REVIEWER_ACCESSIBLE_DOCUMENT_URL]`은 심사자가 실제로 접근할 수 있는 샘플로 바꾸세요. 개인 Google 계정의 비밀번호를 제공하지 마세요. 로컬 가상 테스트는 실서비스 접근 권한을 제공하지 않습니다.

데이터 신고에서는 로컬 처리도 공개해야 합니다. 문서 콘텐츠, 선택한 URL·제목, 원문 안에 포함될 수 있는 식별 정보를 코드와 일치하게 작성합니다. 스토어의 최신 항목 정의를 확인한 후 게시자가 인증 문구에 동의하세요.

## 재생성

`npm run build` 후 `python scripts/prepare_store_assets.py`로 아이콘과 SVG를 준비합니다. 개발 문서의 통합 검사로 `output/playwright/exported-demo-one.html`을 만든 뒤 별도 오프라인 브라우저에서 그 파일을 열고 `scripts/capture_store_screenshots.js`를 실행합니다. 스크린샷은 UI를 합성하거나 숨기지 않고 1280×800으로 촬영하며 SVG는 정해진 크기로 PNG를 생성합니다.

완성된 규격은 `python scripts/verify_store_assets.py`로 확인할 수 있습니다. 전체 미리보기는 `index.html`입니다.

## 공식 기준

- [스토어 등록](https://developer.chrome.com/docs/webstore/publish)
- [이미지 규격](https://developer.chrome.com/docs/webstore/images)
- [권한과 개인정보 신고](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [로컬 데이터 처리와 정책](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [브랜드 표시](https://developer.chrome.com/docs/webstore/branding)
