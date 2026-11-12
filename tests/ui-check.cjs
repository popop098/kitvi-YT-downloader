// Run explicitly with an Electron executable. Fake host responses exercise only UI;
// real engine integration is covered separately by Kitvi's media-official-probe.mjs.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve(__dirname, '..'); const artifacts = resolve(root, '.verification'); mkdirSync(artifacts, { recursive: true });
const sleep = (time) => new Promise((done) => setTimeout(done, time));
let win;
const js = (code) => win.webContents.executeJavaScript(code);
async function until(code) { for (let index = 0; index < 80; index++) { if (await js(code)) return; await sleep(30); } throw new Error(`Timed out: ${code}`); }
async function capture(name) { await js('document.fonts.ready'); await sleep(80); writeFileSync(resolve(artifacts, `${name}.png`), (await win.capturePage()).toPNG()); }
app.whenReady().then(async () => {
  try {
    win = new BrowserWindow({ show: false, width: 1100, height: 1000, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } });
    await win.loadFile(resolve(root, 'ui/index.html'));
    await js(`(() => {
      window.calls = []; window.appearance = 'light'; window.media = { engine: { phase: 'missing', version: null, progress: null, message: null }, folder: null, jobs: [] };
      window.sendState = () => window.postMessage({ type: 'kitvi:state', state: { appearance: window.appearance, media: window.media, plugin: { id: 'kitvi.yt-downloader', name: 'YT Downloader', version: '0.1.0' } } }, '*');
      window.addEventListener('message', (event) => {
        const data = event.data; if (data.type === 'kitvi:hello') { window.sendState(); return; } if (data.type !== 'kitvi:request') return;
        window.calls.push(data.method); let result;
        if (data.method === 'media.installEngine') { window.media.engine = { phase: 'ready', version: 'fixture', progress: 100, message: null }; result = window.media; }
        if (data.method === 'downloads.chooseFolder') { window.media.folder = 'C:/Downloads'; result = window.media; }
        if (data.method === 'media.status') result = window.media;
        if (data.method === 'media.analyze') result = { id: 'YE7VzlLtp-4', title: '<b>Big Buck Bunny</b>', uploader: 'Blender', duration: 597, thumbnail: null };
        if (data.method === 'media.start') { result = { id: 'fixture', pluginId: 'kitvi.yt-downloader', title: 'Big Buck Bunny', url: data.params.url, mode: data.params.mode, phase: 'running', progress: 42, downloadedBytes: 10240000, totalBytes: 25333815, speed: 1024000, eta: 14, filename: null, error: null, startedAt: new Date().toISOString() }; window.media.jobs = [result]; }
        if (data.method === 'media.cancel') { window.media.jobs[0].phase = 'cancelled'; result = null; }
        window.postMessage({ type: 'kitvi:response', requestId: data.requestId, ok: true, result }, '*'); window.sendState();
      }); window.kitviPlugin.ready();
    })()`);
    await until('calls.includes("storage.get")');
    assert.equal(await js('typeof window.require'), 'undefined'); assert.equal(await js('document.getElementById("start-download").disabled'), true);
    await capture('initial-light');
    await js('document.getElementById("install-engine").click()'); await until('!document.getElementById("analyze").disabled');
    await js('document.getElementById("choose-folder").click()'); await until('!document.getElementById("open-folder").disabled');
    await js('document.getElementById("video-url").value="https://www.youtube.com/watch?v=YE7VzlLtp-4"; document.getElementById("video-url").dispatchEvent(new Event("input"))');
    assert.equal(await js('calls.includes("media.analyze") || calls.includes("media.start")'), false, 'paste cannot trigger network/media actions');
    await js('document.getElementById("analyze-form").requestSubmit()'); await until('!document.getElementById("start-download").disabled');
    assert.equal(await js('document.querySelector("#video-title b")'), null, 'metadata must render as text');
    await js('document.getElementById("start-download").click()'); await until('document.querySelectorAll(".job").length === 1'); await capture('running-light');
    await js('window.appearance="dark"; window.sendState()'); await until('document.documentElement.dataset.theme === "dark"'); await capture('running-dark');
    win.setSize(450, 900); await sleep(100); assert.equal(await js('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), true); await capture('compact-dark');
    await js('document.querySelector(".job-cancel").click()'); await until('document.querySelector(".job-detail").textContent.includes("취소됨")');
    assert.equal(await js('document.querySelector(".job-cancel")'), null);
    assert.equal(await js('document.fonts.check("16px Pretendard")'), true);
    const report = { result: 'PASS', assertions: ['explicit engine and folder setup', 'no media action on paste', 'analyze/start/cancel UI', 'metadata text safety', 'light/dark', 'compact no overflow', 'local Pretendard'], calls: await js('calls') }; writeFileSync(resolve(artifacts, 'ui-report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); app.quit();
  } catch (error) { console.error(error.stack); process.exitCode = 1; app.quit(); }
});
