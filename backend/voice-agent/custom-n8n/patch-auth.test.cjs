'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

test('auth overlay is idempotent and refuses unsupported source', () => {
  const directory = mkdtempSync(join(tmpdir(), 'chatty-auth-test-'));
  try {
    const file = join(directory, 'auth.cjs');
    const run = () => spawnSync(process.execPath, [join(__dirname, 'patch-auth.cjs'), file]);
    writeFileSync(file, 'const jwtDecode = jsonwebtoken_1.decode || (jsonwebtoken_1.default && jsonwebtoken_1.default.decode);\nconst decoded = jwtDecode ? jwtDecode(sbToken) : null;');
    assert.equal(run().status, 0);
    const patched = readFileSync(file, 'utf8');
    assert.match(patched, /await require/);
    assert.equal(run().status, 0);
    assert.equal(readFileSync(file, 'utf8'), patched);
    writeFileSync(file, 'unsupported source');
    assert.notEqual(run().status, 0);
    assert.equal(readFileSync(file, 'utf8'), 'unsupported source');
  } finally {
    rmSync(directory, { recursive: true });
  }
});
