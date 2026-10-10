import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileFingerprint } from '../src/services/fileFingerprint';

test('archivos con el mismo contenido tienen una misma huella SHA-256', async () => {
  const bytes = new TextEncoder().encode('mismo excel').buffer as ArrayBuffer;
  const same = new TextEncoder().encode('mismo excel').buffer as ArrayBuffer;
  assert.equal(await fileFingerprint(bytes), await fileFingerprint(same));
  assert.match(await fileFingerprint(bytes), /^[0-9a-f]{64}$/);
});
test('un archivo modificado tiene una huella distinta', async () => {
  const a = new TextEncoder().encode('A').buffer as ArrayBuffer;
  const b = new TextEncoder().encode('B').buffer as ArrayBuffer;
  assert.notEqual(await fileFingerprint(a), await fileFingerprint(b));
});
