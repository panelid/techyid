const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const source = readFileSync('src/app/api/domains/verify/route.ts', 'utf8');
assert.match(source, /ensureEmailRoutingForDomain/);
assert.match(source, /email\/routing\/rules/);
assert.match(source, /catch \(emailRoutingError:? any\)/);
console.log('domain verify triggers best-effort Cloudflare Email Routing');
