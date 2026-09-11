import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

function harness() {
  const events = {}, shown = [], opened = [], messages = [];
  const active = [];
  const self = { location: { origin: 'https://school.example' }, skipWaiting() {},
    addEventListener(name, handler) { events[name] = handler; },
    registration: {
      async getNotifications({ tag }) { return active.filter(n => n.tag === tag); },
      async showNotification(title, options) { shown.push({ title, ...options }); active.push(options); },
    },
    clients: { async claim() {}, async matchAll() { return [{ url: 'https://school.example/admin', postMessage(m) { messages.push(m); } }]; },
      async openWindow(path) { opened.push(path); } },
  };
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), { self, URL, encodeURIComponent });
  async function fire(name, properties) { let pending; events[name]({ ...properties, waitUntil(p) { pending = p; } }); await pending; }
  return { fire, shown, opened, messages, events };
}

test('background push is visible, allows OS sound and does not ring twice on retry', async () => {
  const h = harness();
  const data = { json: () => ({ title: 'Новая оценка', body: 'Откройте кабинет', notificationId: '12345678-1234-1234-1234-123456789abc' }) };
  await h.fire('push', { data }); await h.fire('push', { data });
  assert.equal(h.shown.length, 1); assert.equal(h.shown[0].silent, false);
  assert.equal(h.messages.length, 2); assert.equal(h.events.fetch, undefined);
});
test('malformed payload still produces a visible notification', async () => {
  const h = harness(); await h.fire('push', { data: { json() { throw new Error('bad JSON'); } } });
  assert.equal(h.shown[0].title, 'OPEN STARS');
});
test('click opens parent cabinet and rejects external destinations', async () => {
  const h = harness(); await h.fire('notificationclick', { notification: { close() {}, data: { notificationId: 'https://evil.example' } } });
  assert.deepEqual(h.opened, ['/']);
});
