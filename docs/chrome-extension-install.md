# Chrome 설치 및 사용

[English](install.md) · [GitHub Releases](https://github.com/hcscat/deep-review-downloader/releases)

배포는 GitHub Releases로만 진행하며 웹스토어 등록은 보류했습니다. 자동 생성 Source code ZIP 대신 버전이 붙은 확장 ZIP을 받으세요.

1. 배포 ZIP을 압축 해제합니다. 개발 빌드는 `dist/deep-review-extension` 폴더를 바로 사용할 수 있습니다.
2. Chrome 주소창에 `chrome://extensions`를 입력하고 개발자 모드를 켭니다.
3. **압축해제된 확장 프로그램을 로드합니다**에서 `manifest.json`이 있는 폴더를 선택합니다.
4. **Deep Review HTML Exporter**를 퍼즐 메뉴에서 고정합니다.
5. 평소처럼 Deep Review에 로그인하고 저장할 리뷰를 연 뒤 확장 버튼을 한 번 누릅니다.

별도 작업 탭이 수집·다운로드를 진행하고, 배지가 `✓`가 되면 완료입니다. 기본 경로는 Chrome 다운로드 위치 아래 `DeepReview/`이며 문서 이름과 제공되는 버전 정보를 파일명에 사용합니다. Chrome의 저장 위치 확인 설정이 켜져 있으면 저장 대화상자가 나타납니다. 동일 이름은 덮어쓰지 않습니다.

수집 중에는 원본 탭을 닫거나 문서·버전을 바꾸지 마세요. 수집기는 임시로 Report를 Comments로, 필터를 All Types로 바꾼 뒤 원래 모드·필터·스크롤·포커스로 복원합니다. 오류는 작업 탭에 표시합니다.

단일 HTML은 확장 프로그램 없이 다른 PC에서도 오프라인으로 열 수 있습니다. PDF 부분은 이미지이므로 PDF 텍스트 선택·검색과 벡터 재렌더링은 지원하지 않습니다. Report는 같은 스냅샷의 전체 피드백과 코멘트로 구성합니다. 원본에서 이미 Dismiss하여 DOM에서 사라진 항목이나 제공되지 않은 마지막 페이지의 존재까지 추정할 수 없습니다.

설치에 Node.js나 Python은 필요하지 않습니다. 등록한 폴더는 유지하세요. 업데이트할 때는 폴더를 새 버전으로 교체한 후 확장 카드와 원본 Deep Review 탭을 새로고침합니다. 확장을 삭제해도 사용자가 다운로드한 HTML은 남습니다.

현재 권한은 `activeTab`, `scripting`, `downloads`입니다. 비밀번호·인증 토큰·쿠키·웹 저장소를 읽지 않으며 개발자 서버로 리뷰를 업로드하지 않습니다.

[Chrome 공식 로컬 설치 안내](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world)

확장 화면은 Chrome 표시 언어에 따라 영어 기본·한국어를 지원하며, 저장 뷰어에서는 언어를 직접 선택할 수 있습니다. 원문 내용은 번역하지 않습니다. 취소하면 이번 작업의 다운로드만 중단하고, ID가 도착하기 전에 이미 완료되었다면 이번 파일만 제거합니다. 제거 실패는 화면에 표시합니다. 다운로드 생성 중 작업 탭을 닫는 것은 취소 버튼과 다릅니다.
