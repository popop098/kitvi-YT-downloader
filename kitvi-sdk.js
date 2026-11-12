/* Kitvi Plugin SDK 1. MIT License. */
(() => {
  'use strict';
  const pending = new Map();
  const listeners = new Set();
  let sequence = 0;
  let latestState;
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || !event.data || typeof event.data !== 'object') return;
    const data = event.data;
    if (data.type === 'kitvi:response' && typeof data.requestId === 'string') {
      const call = pending.get(data.requestId);
      if (!call) return;
      clearTimeout(call.timer); pending.delete(data.requestId);
      if (data.ok === true) call.resolve(data.result);
      else call.reject(new Error(typeof data.error === 'string' ? data.error : 'Kitvi 요청에 실패했습니다.'));
    }
    if (data.type === 'kitvi:state' && data.state && typeof data.state === 'object') {
      latestState = data.state;
      for (const listener of listeners) { try { listener(latestState); } catch (error) { console.error(error); } }
    }
  });
  window.kitviPlugin = Object.freeze({
    request(method, params = {}) {
      if (typeof method !== 'string' || !method.length || method.length > 80) return Promise.reject(new Error('올바른 SDK 메서드가 아닙니다.'));
      if (pending.size >= 20) return Promise.reject(new Error('이전 요청이 끝난 뒤 다시 시도해 주세요.'));
      const requestId = `sdk1-${Date.now()}-${++sequence}`;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('Kitvi 응답 시간이 초과되었습니다.')); }, method === 'media.installEngine' ? 400000 : 100000);
        pending.set(requestId, { resolve, reject, timer });
        window.parent.postMessage({ type: 'kitvi:request', requestId, method, params }, '*');
      });
    },
    onState(listener) {
      if (typeof listener !== 'function') throw new TypeError('상태 수신 함수를 전달해 주세요.');
      listeners.add(listener); if (latestState) listener(latestState);
      return () => listeners.delete(listener);
    },
    ready() { window.parent.postMessage({ type: 'kitvi:hello' }, '*'); },
  });
})();
