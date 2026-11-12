// Run through scripts/test-ui.mjs. Actual plugin resources run inside the same
// iframe and response CSP sandbox restrictions as the Kitvi host. Only the
// host's SDK responses are mocked; no engine or network requests are made.
const { app, BrowserWindow, protocol } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { extname, relative, resolve } = require('node:path');

if (!process.env.KITVI_UI_VERIFICATION_RUN || !process.env.KITVI_UI_VERIFICATION_REPORT || !process.env.KITVI_UI_VERIFICATION_PROFILE) app.exit(2);
const root = resolve(__dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'kitvi-plugin.json'), 'utf8'));
const artifacts = resolve(root, '.verification');
const profile = resolve(process.env.KITVI_UI_VERIFICATION_PROFILE);
assert.ok(!relative(artifacts, profile).startsWith('..'), 'Verification profile must stay in .verification');
mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
app.setPath('sessionData', profile);
app.setPath('logs', profile);
protocol.registerSchemesAsPrivileged(['kitvi', 'kitvi-plugin'].map((scheme) => ({ scheme, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } })));
const pluginCsp = "sandbox allow-scripts; default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'none'";
const hostCsp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src kitvi-plugin:; form-action 'none'";
const parentScript = `(() => {
  const frame = document.querySelector('iframe');
  const plugin = ${JSON.stringify({ id: manifest.id, name: manifest.name, version: manifest.version })};
  const media = { engine: { phase: 'ready', version: 'fixture', progress: null, message: null }, folder: 'C:/Fixture/Downloads', jobs: [] };
  window.calls = []; window.pendingAnalyze = [];
  const respond = (request, ok, value) => frame.contentWindow.postMessage({ type: 'kitvi:response', requestId: request.requestId, ok, ...(ok ? { result: value } : { error: value }) }, '*');
  window.finishAnalyze = (ok = true) => {
    const request = window.pendingAnalyze.shift();
    if (!request) throw new Error('No pending analysis');
    respond(request, ok, ok ? { id: 'fixture', title: '<b>Fixture video</b>', uploader: 'Fixture uploader', duration: 90, thumbnail: null } : '네트워크 연결을 확인해 주세요.');
  };
  addEventListener('message', (event) => {
    if (event.source !== frame.contentWindow || !event.data) return;
    const data = event.data;
    if (data.type === 'kitvi:hello') { frame.contentWindow.postMessage({ type: 'kitvi:state', state: { appearance: 'light', media, plugin } }, '*'); return; }
    if (data.type !== 'kitvi:request') return;
    window.calls.push({ method: data.method, params: data.params });
    if (data.method === 'media.analyze') { window.pendingAnalyze.push(data); return; }
    respond(data, true, data.method === 'media.status' ? media : null);
  });
})();`;
const sleep = (time) => new Promise((done) => setTimeout(done, time));
let win;
let pluginFrame;
const report = { runId: process.env.KITVI_UI_VERIFICATION_RUN, result: 'FAIL', sandbox: { iframe: 'allow-scripts', csp: pluginCsp }, checks: [], consoleMessages: [] };
const host = (code) => win.webContents.executeJavaScript(code);
const ui = (code) => pluginFrame.executeJavaScript(code);
async function until(work, message) {
  for (let index = 0; index < 100; index++) { if (await work()) return; await sleep(25); }
  throw new Error(`Timed out: ${message}`);
}
async function reset() {
  await win.loadURL('kitvi://fixture/index.html');
  // Chromium focus emulation permits trusted keyboard input while this test
  // window stays hidden; initialize it after a document has loaded.
  if (!win.webContents.debugger.isAttached()) win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true });
  await until(async () => {
    pluginFrame = win.webContents.mainFrame.frames.find((frame) => frame.url.startsWith('kitvi-plugin://kitvi.yt-downloader/'));
    return pluginFrame && await ui('Boolean(window.kitviPlugin && !document.getElementById("analyze").disabled)').catch(() => false);
  }, 'plugin SDK receives ready engine state');
}
async function paste() {
  await ui(`const input = document.getElementById('video-url'); input.value='https://www.youtube.com/watch?v=YE7VzlLtp-4'; input.dispatchEvent(new Event('input', { bubbles:true }));`);
  await sleep(75);
}
async function analyzeCount() { return host('window.calls.filter(call => call.method === "media.analyze").length'); }
async function clickAnalyze() {
  await ui('document.getElementById("analyze").click()');
  await sleep(100);
  assert.equal(await analyzeCount(), 1, 'native Analyze button click must send exactly one media.analyze request');
}
async function check(name, work) {
  try { await reset(); await work(); report.checks.push({ name, result: 'PASS' }); }
  catch (error) { report.checks.push({ name, result: 'FAIL', error: error.message, stack: error.stack }); }
}
app.whenReady().then(async () => {
  try {
    protocol.handle('kitvi', (request) => {
      const url = new URL(request.url);
      if (url.pathname === '/parent.js') return new Response(parentScript, { headers: { 'Content-Type': 'text/javascript; charset=UTF-8', 'Content-Security-Policy': hostCsp } });
      return new Response('<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style><script src="parent.js" defer></script></head><body><iframe title="YT Downloader fixture" sandbox="allow-scripts" referrerpolicy="no-referrer" src="kitvi-plugin://kitvi.yt-downloader/ui/index.html"></iframe></body></html>', { headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Content-Security-Policy': hostCsp } });
    });
    protocol.handle('kitvi-plugin', (request) => {
      const url = new URL(request.url);
      const path = resolve(root, `.${decodeURIComponent(url.pathname)}`);
      if (url.hostname !== 'kitvi.yt-downloader' || relative(root, path).startsWith('..')) return new Response('Not found', { status: 404 });
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' }[extname(path)] || 'application/octet-stream';
      return new Response(new Uint8Array(readFileSync(path)), { headers: { 'Content-Type': mime, 'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': pluginCsp } });
    });
    win = new BrowserWindow({ show: false, width: 1100, height: 1000, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true, webSecurity: true } });
    win.webContents.on('console-message', (event) => report.consoleMessages.push(event.message));
    await check('pasting a URL makes no media request', async () => {
      await paste();
      assert.deepEqual(await host('window.calls.filter(call => call.method.startsWith("media.")).map(call => call.method)'), []);
    });
    await check('native Analyze click shows pending state then metadata', async () => {
      await paste(); await clickAnalyze();
      const pending = await ui(`(() => { const group=document.getElementById('analyze-form'), notice=document.getElementById('notice'); return { busy:group.getAttribute('aria-busy'),buttonDisabled:document.getElementById('analyze').disabled,inputDisabled:document.getElementById('video-url').disabled,buttonText:document.getElementById('analyze').textContent,noticeVisible:!notice.hidden && notice.getBoundingClientRect().height>0,noticeText:notice.textContent,noticeByUrl:group.contains(notice) }; })()`);
      assert.equal(pending.busy, 'true', 'URL group announces pending state');
      assert.equal(pending.buttonDisabled, true); assert.equal(pending.inputDisabled, true);
      assert.match(pending.buttonText, /확인 중/); assert.equal(pending.noticeVisible, true); assert.equal(pending.noticeByUrl, true); assert.match(pending.noticeText, /확인/);
      await host('window.finishAnalyze(true)');
      await until(() => ui('!document.getElementById("start-download").disabled'), 'successful analysis enables download');
      assert.equal(await ui('document.getElementById("video-title").textContent'), '<b>Fixture video</b>');
      assert.equal(await ui('document.querySelector("#video-title b")'), null, 'metadata stays text');
      assert.equal(await ui('document.getElementById("analyze-form").getAttribute("aria-busy")'), 'false');
      assert.equal(await analyzeCount(), 1, 'analysis response must not cause another request');
    });
    await check('Enter in the URL input sends one analysis request', async () => {
      await paste(); win.webContents.focus();
      await ui('(() => { window.fixtureEnterTrusted = null; const input=document.getElementById("video-url"); input.addEventListener("keydown", event => { window.fixtureEnterTrusted=event.isTrusted; }, { once:true }); input.focus(); })()');
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
      await sleep(100);
      assert.equal(await ui('window.fixtureEnterTrusted'), true, 'Enter must be a trusted Chromium key event');
      assert.equal(await analyzeCount(), 1, 'Enter must send exactly one media.analyze request');
      await host('window.finishAnalyze(true)');
    });
    await check('analysis failure appears beside the URL and permits retry', async () => {
      await paste(); await clickAnalyze(); await host('window.finishAnalyze(false)');
      await until(() => ui('!document.getElementById("analyze").disabled'), 'failure releases pending state');
      const failure = await ui(`(() => { const notice=document.getElementById('notice');return {visible:!notice.hidden && notice.getBoundingClientRect().height>0,text:notice.textContent,byUrl:document.getElementById('analyze-form').contains(notice),error:notice.classList.contains('error'),downloadDisabled:document.getElementById('start-download').disabled}; })()`);
      assert.equal(failure.visible, true); assert.equal(failure.byUrl, true); assert.equal(failure.error, true); assert.match(failure.text, /네트워크 연결/); assert.equal(failure.downloadDisabled, true);
      await ui('document.getElementById("analyze").click()'); await sleep(100);
      assert.equal(await analyzeCount(), 2, 'retry sends one new request');
      await host('window.finishAnalyze(true)');
    });
    report.result = report.checks.every((entry) => entry.result === 'PASS') ? 'PASS' : 'FAIL';
  } catch (error) { report.checks.push({ name: 'harness', result: 'FAIL', error: error.message, stack: error.stack }); }
  finally {
    try { writeFileSync(process.env.KITVI_UI_VERIFICATION_REPORT, JSON.stringify(report, null, 2)); }
    finally {
      // The Node runner owns failure exit status and logs; Electron always shuts
      // down normally so a failed assertion cannot leave a hidden child behind.
      app.quit();
    }
  }
});
