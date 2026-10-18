#!/usr/bin/env node
// Publish reviewed knowledge only; never searches, fills quotas or starts a deployment.
const fs = require('node:fs'), path = require('node:path');
const {validateCounterintuitiveLearning, mergeCounterintuitiveLearning} = require('./lib/counterintuitive-learning');
try {
  if (!process.argv[2]) throw new Error('用法：npm run learning:publish-counterintuitive -- <本轮载荷.json>');
  const root = path.resolve(__dirname, '..'), file = path.join(root, 'data/counterintuitive-learning.json');
  const config = JSON.parse(fs.readFileSync(path.join(root, 'config/learning.json'), 'utf8'));
  const old = JSON.parse(fs.readFileSync(file, 'utf8'));
  const before = validateCounterintuitiveLearning(config, old);
  if (before.errors.length) throw new Error('既有数据须先核对：' + before.errors.join('；'));
  const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const data = mergeCounterintuitiveLearning(config, old, input);
  fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(file + '.tmp', file);
  console.log(`保存${input.items.length}条新知识，完整保留往期；尚未提交或部署。`);
} catch (error) {console.error(error.message); process.exitCode = 1;}
