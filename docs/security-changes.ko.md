# 1.0.2 수정 전후 설명

[English](security-changes.md)

아래는 관련 부분을 발췌한 비교입니다. 실제 구현은 `extension/src/snapshot.ts`, `extension/src/export.ts`에 있습니다. 예시는 모두 가상 값입니다.

## 1. HTML에 불필요한 정보가 남는 문제

**Before:** 위험하다고 알려진 속성을 골라 제거했습니다. 목록에 없는 `data-*`, `ping` 같은 속성과 HTTPS 링크의 쿼리는 남았습니다.

```ts
if (name.startsWith("on") || ["id", "nonce", "srcset", "srcdoc", "formaction", "routerlink"].includes(name))
  el.removeAttribute(attr.name);
```

**After:** 기본값을 제거로 바꾸고, 서식·수식에 필요한 것으로 명시한 경우만 보존합니다.

```ts
let keep = false;
// class, 검증한 CSS, 수식 전용 속성, 내장 이미지 등을 개별 허용
if (!keep) el.removeAttribute(attr.name);
```

참조 링크는 별도 함수에서 계정 정보·쿼리·프래그먼트를 지웁니다.

```ts
url.username = "";
url.password = "";
url.search = "";
url.hash = "";
```

예를 들어 `https://reference.invalid/paper?token=example#section`은 `https://reference.invalid/paper`로 저장됩니다. `ping`이나 임의의 숨은 속성은 제거합니다. 수식 표시용 MathML·SVG 텍스트와 보고서 복사용 수식 속성은 명시적으로 보존합니다.

이것은 개인정보 자동 익명화가 아닙니다. URL 경로·본문·수식·이미지 안의 정보는 남습니다. 쿼리로 대상을 지정하는 링크는 기능이 달라질 수 있습니다. 문서 출처 URL은 별도 규칙으로 문서 식별자를 보존하며, 방침과 README도 이 범위에 맞췄습니다.

## 2. 취소해도 다운로드가 시작되는 문제

**Before:** 수집이 끝나 포트가 닫힌 뒤에도 취소 버튼이 메시지를 보내 예외가 났습니다. 그 사이 Chrome의 다운로드 ID가 늦게 도착하면 저장이 진행될 수 있었습니다.

```ts
finished = true;
port?.postMessage({ type: "cancel" });
port?.disconnect();
```

**After:** 포트 참조를 먼저 비우고 한 번만 닫습니다. 이미 닫혀 있어도 취소 처리가 계속됩니다. 원본 수집기는 연결 종료를 감지해 중단·복원합니다.

```ts
const active = port;
port = undefined;
try { active?.disconnect(); } catch { /* 이미 종료됨 */ }
```

다운로드 ID를 받은 직후에도 작업 종료 상태를 재확인합니다.

```ts
if (finished) {
  try { await discardDownload(downloadId); }
  catch (error) { if (cancelRequested) cancellationFailed(error); }
  return;
}
```

취소 요청은 별도 변수에 기억합니다. 늦게 받은 ID도 취소하고, 그 사이 완료된 경우에는 **이번 작업이 만든 파일만** 제거합니다. 다른 다운로드는 건드리지 않습니다. 제거에 실패하면 Chrome 다운로드를 확인하라는 안내를 표시하고, 늦게 도착한 성공 응답이 취소 화면을 덮어쓰지 않게 했습니다.

회귀 검사는 자원 읽기 중, ID 발급 대기 중, 파일 완료 후 ID 전달 전을 의도적으로 멈춰 취소합니다. 파일 제거 실패도 재현하여 안내와 예외 유무를 확인합니다.
