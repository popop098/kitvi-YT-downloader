/* Example UI. Native operations are requested only through Kitvi SDK 1. */
(() => {
  'use strict';
  const sdk = window.kitviPlugin;
  const $ = (id) => document.getElementById(id);
  let media = { engine: { phase: 'missing', version: null }, folder: null, jobs: [] };
  let info = null; let analyzedInput = ''; let busy = false; let analyzing = false; let preferencesLoaded = false;
  const phaseLabels = { queued: '대기 중', running: '다운로드 중', completed: '완료', cancelled: '취소됨', error: '실패' };
  const bytes = (value) => { if (typeof value !== 'number' || !Number.isFinite(value)) return ''; return value >= 1073741824 ? `${(value / 1073741824).toFixed(2)} GB` : `${(value / 1048576).toFixed(1)} MB`; };
  const time = (seconds) => { if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return ''; const value = Math.floor(seconds); return value >= 3600 ? `${Math.floor(value / 3600)}:${String(Math.floor(value / 60) % 60).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}` : `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`; };
  function notice(message, error = false) { $('notice').textContent = message; $('notice').hidden = !message; $('notice').classList.toggle('error', error); }
  function applyMedia(value) { if (value && typeof value === 'object' && value.engine && Array.isArray(value.jobs)) { media = value; render(); } }
  async function refresh() { applyMedia(await sdk.request('media.status')); }
  async function action(work) { if (busy) return; busy = true; notice(''); render(); try { await work(); } catch (error) { notice(error.message || '요청을 완료하지 못했습니다.', true); } finally { busy = false; render(); } }
  function render() {
    const ready = media.engine.phase === 'ready'; const installing = media.engine.phase === 'installing'; const active = media.jobs.some((job) => job.phase === 'running' || job.phase === 'queued');
    $('engine-message').textContent = ready ? `yt-dlp ${media.engine.version || ''} · 사용 가능` : media.engine.message || (installing ? '공식 yt-dlp 엔진을 설치하고 있습니다.' : '처음 한 번, 공식 yt-dlp 엔진을 설치해 주세요.');
    $('install-engine').hidden = ready; $('install-engine').disabled = busy || installing; $('install-engine').textContent = installing ? '설치 중…' : media.engine.phase === 'error' ? '설치 다시 시도' : '엔진 설치';
    $('engine-progress').hidden = !installing; if (typeof media.engine.progress === 'number') $('engine-progress').value = media.engine.progress; else $('engine-progress').removeAttribute('value');
    $('folder-path').textContent = media.folder || '다운로드할 폴더를 선택해 주세요.'; $('open-folder').disabled = !media.folder || busy; $('choose-folder').disabled = busy; $('choose-folder').textContent = media.folder ? '폴더 변경' : '폴더 선택';
    $('analyze').disabled = busy || !ready || active; $('analyze').textContent = analyzing ? '확인 중…' : '정보 확인'; $('video-url').disabled = busy;
    $('analyze-form').setAttribute('aria-busy', String(analyzing));
    $('start-download').disabled = busy || !ready || !media.folder || !info || analyzedInput !== $('video-url').value.trim() || active;
    $('mode-select').disabled = busy || active; $('video-info').hidden = !info;
    if (info) { $('video-title').textContent = info.title; $('video-details').textContent = [info.uploader, time(info.duration)].filter(Boolean).join(' · '); }
    $('empty-jobs').hidden = media.jobs.length > 0; $('job-count').textContent = `${media.jobs.length}개`;
    const list = document.createDocumentFragment();
    for (const job of media.jobs.slice(0, 20)) {
      const item = document.createElement('li'); item.className = `job ${job.phase}`;
      const heading = document.createElement('div'); heading.className = 'job-heading';
      const title = document.createElement('p'); title.className = 'job-title'; title.textContent = job.title; heading.append(title);
      const running = job.phase === 'running' || job.phase === 'queued';
      if (running) { const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'job-cancel'; cancel.textContent = '취소'; cancel.addEventListener('click', () => { cancel.disabled = true; sdk.request('media.cancel', { jobId: job.id }).then(refresh).catch((error) => { notice(error.message, true); cancel.disabled = false; }); }); heading.append(cancel); }
      item.append(heading);
      const detail = document.createElement('p'); detail.className = 'job-detail';
      detail.textContent = job.error || [phaseLabels[job.phase] || job.phase, job.mode === 'audio' ? '오디오' : '영상', running && job.progress != null ? `${Math.floor(job.progress)}%` : '', running ? bytes(job.downloadedBytes) + (job.totalBytes ? ` / ${bytes(job.totalBytes)}` : '') : '', running && job.speed ? `${bytes(job.speed)}/s` : '', running && job.eta != null ? `남은 시간 ${time(job.eta)}` : '', job.phase === 'completed' ? job.filename : ''].filter(Boolean).join(' · ');
      item.append(detail);
      if (running) { const progress = document.createElement('progress'); progress.max = 100; if (job.progress != null) progress.value = job.progress; progress.setAttribute('aria-label', `${job.title} 다운로드 진행률`); item.append(progress); }
      list.append(item);
    }
    $('jobs').replaceChildren(list);
  }
  $('install-engine').addEventListener('click', () => action(async () => { applyMedia(await sdk.request('media.installEngine')); await refresh(); }));
  $('choose-folder').addEventListener('click', () => action(async () => { await sdk.request('downloads.chooseFolder'); await refresh(); }));
  $('open-folder').addEventListener('click', () => action(async () => { await sdk.request('downloads.openFolder'); }));
  $('video-url').addEventListener('input', () => { info = null; analyzedInput = ''; notice(''); render(); });
  // SDK 1 disallows native form submission. Explicit actions keep the sandbox
  // unchanged and work for both pointer activation and the Enter key.
  $('analyze').addEventListener('click', () => {
    if ($('analyze').disabled) return;
    if (!$('video-url').checkValidity()) { notice('올바른 YouTube 영상 주소를 입력해 주세요.', true); $('video-url').focus(); return; }
    action(async () => {
      analyzing = true; info = null; const url = $('video-url').value.trim();
      notice('영상 정보를 확인하고 있어요…'); render();
      try { info = await sdk.request('media.analyze', { url }); analyzedInput = url; notice('영상 정보를 확인했어요. 저장 형식을 고르고 다운로드하세요.'); }
      finally { analyzing = false; }
    });
  });
  $('video-url').addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); $('analyze').click(); } });
  $('start-download').addEventListener('click', () => action(async () => { if (!info || analyzedInput !== $('video-url').value.trim()) return; const mode = document.querySelector('input[name=mode]:checked').value; await sdk.request('media.start', { url: analyzedInput, mode }); await refresh(); }));
  for (const input of document.querySelectorAll('input[name=mode]')) input.addEventListener('change', () => { sdk.request('storage.set', { key: 'mode', value: input.value }).catch((error) => notice(error.message, true)); });
  sdk.onState((state) => {
    document.documentElement.dataset.theme = state.appearance === 'dark' ? 'dark' : 'light'; applyMedia(state.media);
    if (!preferencesLoaded) { preferencesLoaded = true; sdk.request('storage.get', { key: 'mode' }).then((value) => { if (value === 'audio' || value === 'video') document.querySelector(`input[name=mode][value=${value}]`).checked = true; }).catch(() => {}); }
  });
  render(); sdk.ready();
})();
