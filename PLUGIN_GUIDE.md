# Kitvi 플러그인 제작 가이드 · SDK 1

이 문서는 **Kitvi 0.4.0 / API 1**의 공개 정적 UI 플러그인 계약입니다. 이 예제의 HTML·CSS·JavaScript를 수정해 새 플러그인을 만들 수 있습니다. Kitvi 내부 코드를 복사하거나 호스트에 임의 백엔드를 등록할 필요가 없습니다.

## 1. 파일과 manifest

```text
kitvi-plugin.json
kitvi-sdk.js
ui/
  index.html
  styles.css
  app.js
  assets/
LICENSE
THIRD_PARTY_NOTICES.md
```

ZIP의 최상위에 다음 manifest를 둡니다. 아래 키만 사용하며 SDK 1에는 `backend`, 네이티브 모듈, 시작 스크립트 필드가 없습니다.

```json
{
  "apiVersion": 1,
  "id": "kitvi.yt-downloader",
  "name": "YT Downloader",
  "version": "0.1.0",
  "minKitviVersion": "0.4.0",
  "description": "공개 YouTube 영상을 단일 파일 영상 또는 원본 오디오로 저장합니다.",
  "author": "Kitvi",
  "entry": "ui/index.html",
  "permissions": ["storage", "downloads", "media"]
}
```

다른 플러그인으로 배포할 때는 고유한 소문자 dotted ID, 이름, 버전, 설명, 작성자를 바꾸세요. ID는 저장소와 다운로드 작업의 소유자 구분에 사용되므로 배포 후 바꾸면 기존 플러그인과 별개로 취급됩니다. 버전과 `minKitviVersion`은 `0.1.0`처럼 완전한 버전을 사용합니다. `entry`는 패키지 내부의 HTML 상대 경로입니다. 요청한 권한은 설치 전 사용자에게 표시되며 활성화된 플러그인만 API를 사용할 수 있습니다.

정적 HTML/CSS/JS/MJS/JSON, 일반 이미지·글꼴·텍스트를 포함할 수 있습니다. 경로는 `/`로 구분한 정규 상대 경로이며 ZIP 항목에 `..`, 절대 경로, 심볼릭 링크를 넣지 마세요. SDK 1 설치 한도는 ZIP/확장 합계 각각 16 MiB, 항목 256개, 일반 파일 4 MiB, 글꼴 2 MiB입니다. 외부 CDN 대신 필요한 UI 자산을 패키지에 포함하세요. yt-dlp.exe 같은 실행 파일과 `.node` 네이티브 모듈은 넣을 수 없습니다.

## 2. SDK 연결

HTML에서 SDK를 먼저 불러옵니다. 이 예제는 UI가 `ui/` 아래에 있으므로 `../kitvi-sdk.js`를 사용합니다.

```html
<script src="../kitvi-sdk.js" defer></script>
<script src="app.js" defer></script>
```

```javascript
const sdk = window.kitviPlugin;
const unsubscribe = sdk.onState((state) => {
  document.documentElement.dataset.theme = state.appearance;
  // state.plugin: { id, name, version }
  // state.media: { engine, jobs, folder }
});
sdk.ready();

const media = await sdk.request('media.status', {});
// 화면을 해제할 때 필요하면 unsubscribe();
```

`request(method, params)`는 Promise이며 호스트 오류는 `Error`로 거절됩니다. `onState(callback)`은 수신 상태를 전달하고 구독 해제 함수를 반환합니다. 마지막 상태가 있다면 새 구독자에게 즉시 전달합니다. `ready()`는 준비 신호를 보냅니다. 먼저 구독한 뒤 `ready()`를 호출하세요. 이 예제 SDK는 부모 프레임에서 온 응답만 처리하고 요청 ID별로 응답을 연결합니다. API 오류를 사용자에게 보여 주고, 버튼 중복 실행을 막고, DOM에는 `textContent`로 데이터를 표시하세요.

## 3. 메서드와 권한

| 메서드 | params | 반환 | 선언 권한 |
|---|---|---|---|
| `storage.get` | `{ key: string }` | 저장한 JSON 값 또는 `null` | `storage` |
| `storage.set` | `{ key: string, value: JSON값 }` | 성공 응답 | `storage` |
| `downloads.chooseFolder` | `{}` | 선택 결과를 반영한 `MediaState` | `downloads` |
| `downloads.openFolder` | `{}` | 성공 응답 | `downloads` |
| `media.status` | `{}` | 해당 플러그인의 `MediaState` | `media` |
| `media.installEngine` | `{}` | 설치 결과의 `MediaState` | `media` |
| `media.analyze` | `{ url: string }` | `MediaInfo` | `media` |
| `media.start` | `{ url: string, mode: "video" 또는 "audio" }` | `MediaJob` | `media`, `downloads` |
| `media.cancel` | `{ jobId: string }` | 성공 응답 | `media` |

저장소는 플러그인 ID별로 분리됩니다. 작은 설정만 저장하고 비밀정보·쿠키를 넣지 마세요. 저장 폴더는 호스트가 네이티브 대화상자로 선택하고 플러그인 ID에 연결합니다. `media.start`는 `directory`, 실행 파일, shell, 임의 CLI 인수를 받지 않습니다. `downloads.openFolder`는 그 플러그인의 선택 폴더만 엽니다. 취소는 자기 플러그인이 소유한 작업 ID에만 적용됩니다.

```javascript
await sdk.request('downloads.chooseFolder', {});
const info = await sdk.request('media.analyze', {
  url: 'https://www.youtube.com/watch?v=YE7VzlLtp-4'
});
const job = await sdk.request('media.start', {
  url: 'https://www.youtube.com/watch?v=YE7VzlLtp-4', mode: 'video'
});
// 사용자가 취소했을 때:
await sdk.request('media.cancel', { jobId: job.id });
```

엔진 설치·폴더 선택·다운로드는 분명한 사용자 버튼 동작에서 요청하세요. 붙여넣기나 화면 진입만으로 다운로드하지 마세요.

## 4. 상태 형식

```typescript
type MediaInfo = {
  id: string; title: string; duration: number | null;
  uploader: string | null; thumbnail: string | null;
};
type MediaJob = {
  id: string; pluginId: string; title: string; url: string;
  mode: 'video' | 'audio';
  phase: 'queued' | 'running' | 'completed' | 'cancelled' | 'error';
  progress: number | null; // 0..100; 알 수 없으면 null
  downloadedBytes: number; totalBytes: number | null;
  speed: number | null; // bytes/sec
  eta: number | null; // seconds
  filename: string | null; error: string | null; startedAt: string;
};
type MediaState = {
  engine: {
    phase: 'missing' | 'installing' | 'ready' | 'error';
    version: string | null; progress: number | null; message: string | null;
  };
  jobs: MediaJob[]; // 해당 플러그인의 작업만
  folder: string | null;
};
```

호스트 전체 상태는 `{ appearance: 'light' | 'dark', media: MediaState, plugin: { id, name, version } }`입니다. 엔진 설치 상태는 공유되고 작업·폴더는 플러그인별로 구분됩니다. SDK 1의 `thumbnail`은 현재 `null`이며 원시 yt-dlp 메타데이터·미디어 URL·쿠키는 플러그인에 반환하지 않습니다. 작업 기록은 현재 앱 세션의 기록입니다.

## 5. 메시지 프로토콜

직접 bridge를 구현할 때도 아래 형식을 유지합니다. iframe은 opaque origin일 수 있으므로 `event.source === parent`를 확인해야 합니다. 부모 호스트는 활성 프레임을 확인하고 설치된 플러그인 ID·권한을 별도로 검사합니다. 자식이 임의의 플러그인 ID를 보내 권한을 선택할 수 없습니다.

```javascript
// 자식 → 부모
{ type: 'kitvi:hello' }
{ type: 'kitvi:request', requestId: 'unique-id', method: 'media.status', params: {} }
// 부모 → 자식
{ type: 'kitvi:response', requestId: 'unique-id', ok: true, result: {} }
{ type: 'kitvi:response', requestId: 'unique-id', ok: false, error: 'message' }
{ type: 'kitvi:state', state: { appearance: 'dark', media: {}, plugin: {} } }
```

위 코드는 메시지 모양을 나타내는 예시입니다. `postMessage` 대상은 부모이고, 응답의 `requestId`와 `ok`를 검사한 뒤 Promise를 완료하세요. 알 수 없는 요청·메서드·다른 프레임의 응답은 거절하거나 무시합니다.

## 6. 실행 경계

- UI는 sandbox iframe입니다. `require`, Node, Electron IPC, 파일 시스템과 shell에 직접 접근할 수 없습니다. `allow-same-origin`과 임의 팝업·상위 탐색을 요구하지 마세요.
- SDK 1에는 플러그인 제공 네이티브 백엔드, 임의 프로세스 실행, 일반 네트워크 프록시, 임의 파일 읽기/쓰기 API가 없습니다.
- media API는 공식 yt-dlp 엔진과 호스트가 작성한 고정 인수만 사용합니다. YouTube 개별 HTTPS 주소를 정규화하며 임의 사이트·로컬 URL·로그인 자격정보는 받지 않습니다.
- 영상은 MP4 우선 단일 파일, 오디오는 M4A 우선 원본 파일입니다. FFmpeg 병합·변환, 재생목록·라이브·로그인·쿠키·DRM 기능은 없습니다.
- 공식 엔진은 사용자 설치 동작 시 공식 `yt-dlp/yt-dlp` 최신 릴리스에서 받아 `SHA2-256SUMS`의 정확한 `yt-dlp.exe` 항목과 SHA256을 대조합니다. 공식 실행 파일에 포함된 EJS를 사용하며 원격 추가 컴포넌트 다운로드는 꺼집니다.
- 엔진 다운로드는 128 MiB·요청당 120초 제한입니다. 영상 정보는 응답 4 MiB·90초, 파일은 2 GB·2시간 제한이며 앱 종료/취소 시 소유 프로세스 트리를 정리합니다.

더 넓은 권한이나 새로운 호스트 기능이 필요하면 새 SDK 계약이 먼저 필요합니다. manifest에 실행 명령을 추가해서 이 경계를 우회할 수 없습니다.

## 7. 패키징과 설치 확인

Node 24 이상에서 `npm test`와 `npm run package`를 실행합니다. 패키징 스크립트는 Node 표준 라이브러리로 ZIP·CRC32·SHA256을 만들며 실행 파일·심볼릭 링크·크기 초과 파일을 거절합니다. ZIP은 저장소를 감싼 최상위 폴더 없이 manifest부터 시작합니다.

GitHub Releases에는 **정확히 하나의 `*.kitvi-plugin.zip`**과 **`SHA256SUMS.txt`**를 함께 첨부합니다. 체크섬의 각 줄은 다음과 같습니다.

```text
<64자리 SHA256>  kitvi-YT-downloader-0.1.0.kitvi-plugin.zip
```

Kitvi 플러그인 화면에 `owner/repository`를 입력하면 같은 저장소의 릴리스 자산을 확인합니다. 설치 전 manifest·요청 권한을 검토합니다. 로컬 ZIP은 파일을 직접 선택한 뒤 같은 검토 절차를 거칩니다. 실행 전후 밝게/어둡게 테마, 좁은 화면, 엔진 미설치/실패, 폴더 취소, 잘못된 URL, 네트워크 실패, 다운로드 취소, 플러그인 비활성화·제거 상태를 확인하세요. 실제 다운로드 검증 여부는 릴리스 노트에 정확히 기록하세요.

## English reference

SDK 1 plugins are static sandboxed UI packages. Put `kitvi-plugin.json` at the ZIP root and use exactly the manifest keys shown above. Use a unique lowercase dotted ID, full semantic versions, an internal HTML entry, and only the required `storage`, `downloads`, and `media` permissions.

Load `kitvi-sdk.js`, subscribe with `window.kitviPlugin.onState(callback)`, then call `ready()`. Use `request(method, params)` for Promise-based host calls. The method/parameter/result table and TypeScript state definitions above are the normative contract. Errors reject with `Error`. Check `event.source === parent` when writing your own bridge. The parent binds identity to the installed active plugin; child-supplied identity never grants permission.

There is no arbitrary native backend, Node/filesystem/shell access, direct Electron IPC, generic network proxy, or CLI argument API. The download folder is chosen by the host. `media.start` accepts only `{ url, mode }`. Jobs and storage are scoped to the plugin. The media engine supports only public single-video HTTPS YouTube URLs, single-file video and original audio, with 2 GB/two-hour limits. No FFmpeg merge/transcode, playlists, live videos, login/cookies, or DRM options are exposed.

Run `npm test` and `npm run package` with Node 24+. Publish exactly one `*.kitvi-plugin.zip` and `SHA256SUMS.txt` together in a GitHub Release. Checksums use `<SHA256><two spaces><exact ZIP filename>`. ZIP and expanded content each must be at most 16 MiB, with no more than 256 entries, individual files at most 4 MiB and fonts at most 2 MiB. Do not distribute engine executables in the package. Test actual supported flows and document unverified conditions honestly.
