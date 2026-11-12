# YT Downloader 0.1.1

Kitvi 격리 화면에서 **정보 확인** 버튼을 눌러도 반응하지 않던 문제를 수정했습니다.

- 차단되는 HTML 폼 제출을 제거하고 버튼 클릭·Enter 키로 직접 영상 분석 요청을 보냅니다.
- 입력란 바로 아래에 확인 중·성공·오류를 표시하고 실패 후 재시도할 수 있습니다.
- 실제 iframe과 응답 CSP의 sandbox 조건에서 버튼·키 입력·오류 복구를 회귀 검사합니다.
- 실제 Kitvi 호스트와 공식 yt-dlp 엔진으로 영상 정보 표시를 확인했습니다.

## 업데이트

Kitvi **플러그인 목록 → popop098/kitvi-YT-downloader 가져오기 → 0.1.1 확인하고 설치**로 업데이트하세요. 기존 엔진은 계속 사용할 수 있고 Kitvi 앱은 0.4.0 이상을 사용합니다. 기존 0.1.0은 별도 릴리스에 보존합니다.

ZIP으로 설치한 경우에는 같은 로컬 ZIP 경로로 이 릴리스의 새 패키지를 선택하세요. 플러그인 설치기는 동일한 설치 출처에서 버전이 높아진 패키지를 적용합니다.

## English

Fixes Analyze doing nothing in the Kitvi sandbox. Explicit button and Enter actions replace blocked native form submission, with visible pending/error feedback beside the URL. Host permissions remain unchanged. Regression tests now include both iframe and CSP sandbox restrictions; real host/yt-dlp metadata analysis was also verified.

Fetch `popop098/kitvi-YT-downloader` again in Kitvi Plugins and install version 0.1.1. Reuse the existing engine; Kitvi 0.4.0+ remains supported.
