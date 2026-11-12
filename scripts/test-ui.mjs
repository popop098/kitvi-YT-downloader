import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = resolve(root, '.verification');
mkdirSync(artifacts, { recursive: true });
const reportPath = resolve(artifacts, 'sandbox-ui-report.json');
const logPath = resolve(artifacts, 'sandbox-ui-electron.log');
const runId = randomUUID();
const env = { ...process.env, KITVI_UI_VERIFICATION_RUN: runId, KITVI_UI_VERIFICATION_REPORT: reportPath, KITVI_UI_VERIFICATION_PROFILE: resolve(artifacts, `sandbox-ui-profile-${runId}`) };
delete env.ELECTRON_RUN_AS_NODE;
const executable = process.env.ELECTRON_EXE || resolve(root, '../../v2/0.4.0/node_modules/electron/dist/electron.exe');
const log = openSync(logPath, 'w');
const child = spawn(executable, [resolve(root, 'tests/sandbox-ui-check.cjs')], { cwd: root, env, windowsHide: true, stdio: ['ignore', log, log] });
let timedOut = false;
function stop() {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  else child.kill('SIGKILL');
}
const timeout = setTimeout(() => { timedOut = true; stop(); }, 45000);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { stop(); process.exit(1); });
let launchError;
const exitCode = await new Promise((done) => {
  child.once('error', (error) => { launchError = error; done(null); });
  child.once('exit', (code) => done(code));
});
clearTimeout(timeout);
closeSync(log);
let report;
try { report = JSON.parse(readFileSync(reportPath, 'utf8')); } catch {}
if (launchError || timedOut || exitCode !== 0 || report?.runId !== runId) {
  console.error(launchError?.message || (timedOut ? 'Sandbox UI check timed out.' : `Electron exited ${exitCode} without a fresh report.`));
  console.error(`Electron log: ${logPath}`);
  process.exitCode = 1;
} else {
  console.log(`${report.result}: ${report.checks.filter((check) => check.result === 'PASS').length}/${report.checks.length} sandbox UI checks`);
  for (const check of report.checks) console.log(`${check.result} ${check.name}${check.error ? `: ${check.error}` : ''}`);
  console.log(`Report: ${reportPath}`);
  process.exitCode = report.result === 'PASS' ? 0 : 1;
}
