const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const source = readFileSync('src/lib/db/index.ts', 'utf8');
assert.match(source, /type:\s*'url' \| 'wa' \| 'bio' \| 'paste'/);
console.log('type model uses canonical API slug types');
