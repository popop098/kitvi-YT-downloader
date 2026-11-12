import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

async function sdkFixture() {
  const code = await readFile(new URL('../kitvi-sdk.js', import.meta.url), 'utf8'); const posted = []; let listener;
  const parent = { postMessage(message, target) { posted.push({ message, target }); } };
  const window = { parent, addEventListener(type, callback) { if (type === 'message') listener = callback; } };
  runInNewContext(code, { window, console, setTimeout, clearTimeout, Map, Set, Date, Object, Promise, Error, TypeError });
  return { sdk: window.kitviPlugin, posted, receive: (data, source = parent) => listener({ data, source }) };
}

test('SDK correlates host replies and ignores responses from another frame', async () => {
  const { sdk, posted, receive } = await sdkFixture(); const request = sdk.request('storage.get', { key: 'mode' }); const { requestId } = posted[0].message;
  let completed = false; request.then(() => { completed = true; });
  receive({ type: 'kitvi:response', requestId, ok: true, result: 'injected' }, {}); await Promise.resolve(); assert.equal(completed, false);
  receive({ type: 'kitvi:response', requestId, ok: true, result: 'audio' }); assert.equal(await request, 'audio'); assert.equal(posted[0].message.method, 'storage.get');
});

test('SDK propagates host errors and state, and supports listener cleanup', async () => {
  const { sdk, posted, receive } = await sdkFixture(); const states = []; const unsubscribe = sdk.onState((state) => states.push(state));
  sdk.ready(); assert.equal(posted[0].message.type, 'kitvi:hello'); receive({ type: 'kitvi:state', state: { appearance: 'dark' } }); assert.equal(states[0].appearance, 'dark'); unsubscribe(); receive({ type: 'kitvi:state', state: { appearance: 'light' } }); assert.equal(states.length, 1);
  const request = sdk.request('media.cancel', { jobId: 'other' }); receive({ type: 'kitvi:response', requestId: posted.at(-1).message.requestId, ok: false, error: 'Permission denied' }); await assert.rejects(request, /Permission denied/);
});
