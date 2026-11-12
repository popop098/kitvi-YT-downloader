# YT Downloader · Kitvi 플러그인

공개 YouTube 영상 한 편을 **영상 파일** 또는 **원본 오디오**로 저장하는 Kitvi SDK 1 예제입니다. 플러그인 소스는 MIT로 공개하며 Kitvi 코어 소스는 이 저장소에 포함하지 않습니다.

## 설치

1. Windows x64용 **Kitvi 0.4.0 이상**을 실행합니다.
2. Kitvi **플러그인**에서 GitHub 저장소 `popop098/kitvi-YT-downloader`를 추가하거나, [Releases](https://github.com/popop098/kitvi-YT-downloader/releases)에서 받은 `kitvi-YT-downloader-0.1.0.kitvi-plugin.zip`을 로컬 ZIP으로 선택합니다.
3. 이름·버전과 `storage`, `downloads`, `media` 권한을 확인한 뒤 설치합니다.
4. 플러그인을 열고 **엔진 설치**를 누릅니다. Kitvi가 [공식 yt-dlp Releases](https://github.com/yt-dlp/yt-dlp/releases)에서 Windows x64 실행 파일과 `SHA2-256SUMS`를 받아 SHA256을 검증합니다.
5. **폴더 선택** → YouTube 주소 입력 → **정보 확인** → 형식 선택 → **다운로드** 순서로 진행합니다. 붙여넣기만으로 다운로드하지 않습니다.

사용자 PC에 Python·Node·FFmpeg를 따로 설치할 필요가 없습니다. yt-dlp는 Kitvi에 포함된 Node/Electron 런타임을 사용합니다. 엔진 실행 파일은 이 플러그인 ZIP이나 소스에 포함하지 않습니다.

## 지원 범위

| 항목 | 동작 |
|---|---|
| 사이트 | HTTPS 공개 YouTube 개별 영상: `youtube.com/watch?v=…`, `youtu.be/…`, `youtube.com/shorts/…` |
| 영상 | MP4 단일 파일 우선, 없으면 가능한 단일 파일. 고화질 분리 스트림 병합 없음 |
| 오디오 | M4A 원본 우선, 없으면 가능한 원본 오디오. MP3 변환 없음 |
| 제한 | 파일당 2 GB, 작업당 최대 2시간, 한 플러그인에서 동시 다운로드 1개 |
| 작업 | 진행률·속도·남은 시간 표시, 취소, 저장 폴더 열기 |
| 테마 | Kitvi의 밝게/어둡게 설정 자동 반영, 로컬 Pretendard 글꼴 |

재생목록·라이브·예정 영상, 로그인·쿠키 가져오기·브라우저 세션·DRM 처리는 지원하지 않습니다. 같은 이름의 파일을 덮어쓰지 않으며 취소되거나 실패한 작업의 임시 파일은 정리합니다. 완성 파일 이름에는 영상 ID와 작업 ID를 붙입니다. 사이트 변경·지역·연령·네트워크 제한에 따라 공개 영상도 실패할 수 있습니다. 직접 제작했거나 다운로드할 권한이 있는 영상을 사용해 주세요.

## 권한

- `storage`: 선택한 저장 형식(`video`/`audio`)을 플러그인 전용 저장소에 보관합니다.
- `downloads`: Kitvi의 네이티브 대화상자로 저장 폴더를 고르고 엽니다. 임의 경로를 API로 전달하지 않습니다.
- `media`: 호스트의 제한된 yt-dlp 엔진 설치·영상 정보·다운로드·취소 API를 호출합니다.

플러그인은 sandbox iframe에서 실행됩니다. Node, 파일 시스템, shell, Electron IPC를 직접 사용할 수 없고 임의 실행 파일·명령줄 인수를 전달할 수 없습니다. API와 제작 방법은 [PLUGIN_GUIDE.md](PLUGIN_GUIDE.md)를 참고하세요.

## 소스에서 패키징

제작 환경에만 Node 24 이상이 필요합니다. 외부 npm 의존성은 없습니다.

```powershell
git clone https://github.com/popop098/kitvi-YT-downloader.git
cd kitvi-YT-downloader
npm test
npm run package
```

`dist/kitvi-YT-downloader-0.1.0.kitvi-plugin.zip`과 `dist/SHA256SUMS.txt`가 생성됩니다. ZIP에는 최상위 `kitvi-plugin.json`, `kitvi-sdk.js`, UI, 라이선스만 포함됩니다. GitHub Releases로 배포하려면 두 파일을 같은 릴리스의 자산으로 올리세요. 플러그인 설치기는 릴리스 ZIP과 체크섬을 대조합니다. 폰트와 그 라이선스를 제외한 예제 코드는 [MIT](LICENSE)입니다. 별도 다운로드 엔진의 라이선스는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 설명합니다.

## 검증 기록 · 2026-11-12

Windows x64에서 공식 yt-dlp `2026.10.26`을 직접 받아 SHA256을 검증하고, Kitvi에 포함된 Electron `45.3.0` / Node `24.22.2`로 [현재 upstream YouTube 테스트 영상](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube/_video.py)인 Blender의 **Big Buck Bunny** (`YE7VzlLtp-4`)를 분석했습니다. MP4 25,333,815바이트와 원본 M4A 28,914,897바이트 다운로드, Windows 작업 취소·프로세스 정리를 확인했습니다. 별도 Python·Node·FFmpeg 설치는 사용하지 않았습니다.

실제 패키지의 Kitvi 설치 미리보기·확인·HTML/SDK/글꼴 읽기를 검증했습니다. UI는 숨겨진 sandbox Electron 창에서 **테스트용 호스트 응답**으로 버튼 흐름, 붙여넣기 시 자동 실행 없음, 메타데이터 텍스트 처리, 밝게/어둡게, 450px 좁은 화면을 확인했습니다. 이 UI 검사는 실제 엔진 다운로드 검증과 구분됩니다. 다른 영상·지역·네트워크에서의 성공까지 보장하는 결과는 아닙니다.

---

## English

YT Downloader is a public MIT-licensed **Kitvi SDK 1** example for saving one public YouTube video or its original audio. It requires **Kitvi 0.4.0+ on Windows x64**. The Kitvi core source is not part of this repository.

Install the repository `popop098/kitvi-YT-downloader` from Kitvi's Plugins screen, or select the release's `.kitvi-plugin.zip` locally. Review `storage`, `downloads`, and `media` permissions. Open the plugin, choose **엔진 설치** (install engine), select a folder, enter a YouTube URL, choose **정보 확인** (analyze), choose a format, then **다운로드** (download).

Kitvi downloads the official `yt-dlp.exe` from [upstream Releases](https://github.com/yt-dlp/yt-dlp/releases) only when requested, verifies its SHA256 against upstream `SHA2-256SUMS`, and supplies its embedded Node/Electron runtime. The plugin distributes no engine binary. End users need no Python, Node, or FFmpeg installation.

Supported: HTTPS `watch`, `youtu.be`, and `shorts` single-video URLs; best single-file video (MP4 preferred); original audio (M4A preferred); progress, cancellation, and host-selected folders. Limits: 2 GB per file, two hours per job, one download per plugin at a time. Stream merging, MP3 conversion, playlists, live/upcoming videos, login/cookies, and DRM features are unavailable. Availability depends on the source and network. Use videos you own or have permission to download.

The UI runs in a sandbox iframe and uses only the documented host bridge. It has no Node, filesystem, shell, or direct Electron IPC access. See [PLUGIN_GUIDE.md](PLUGIN_GUIDE.md) for the complete SDK 1 contract and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for licenses.

For development, use Node 24+ and run `npm test` then `npm run package`. There are no npm dependencies. Upload the generated plugin ZIP and `SHA256SUMS.txt` together to a GitHub Release. Both are in `dist/`.
