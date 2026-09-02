const fs = require('fs');
const src = fs.readFileSync('src/app/api/domains/verify/route.ts', 'utf8');
function assert(cond, msg) { if (!cond) throw new Error(msg); }

assert(/SELECT\s+id,\s*domain,\s*custom_hostname_id,\s*email_rule_id,\s*verification_token,\s*is_verified,\s*user_id\s+FROM\s+custom_domains/i.test(src), 'domain query must select user_id');
assert(/SELECT\s+email\s+FROM\s+users\s+WHERE\s+id\s*=\s*\?\s+LIMIT\s+1/i.test(src), 'must query users.email by domain.user_id');
assert(/ensureEmailRoutingForDomain\(String\(domain\.domain\),\s*String\(domainUser\.email\)\)/.test(src), 'email routing destination must use users.email from D1');
assert(!/ensureEmailRoutingForDomain\(String\(domain\.domain\),\s*user\.email\)/.test(src), 'must not use session user.email as routing destination');
assert(!/user@email/i.test(src), 'must not contain hardcoded user@email destination');
console.log('domain email routing source OK');
