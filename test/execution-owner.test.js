const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {executeJob} = require('../scripts/update-runner');

test('retired Codex collection and queue schedule fail before config, network or work', () => {
  for (const script of ['update-runner.js', 'schedule-update.js', 'local-updates.js']) {
    const result = spawnSync(process.execPath, [path.join(__dirname, '../scripts', script)], {encoding:'utf8'});
    assert.equal(result.status, 1);
    assert.match(result.stderr, /已停用/);
    assert.match(result.stderr, /Grok Bot/);
  }
});

test('library entry cannot silently fall back to codex exec', async () => {
  await assert.rejects(executeJob({}, {}, () => assert.fail('must not contact queue')), /旧 Codex 内容执行器已停用/);
});
