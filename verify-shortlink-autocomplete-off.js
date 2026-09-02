const fs = require('fs');
const files = [
  'src/components/link-creator.tsx',
  'src/components/LandingClient.tsx',
  'src/components/DashboardClient.tsx',
];
function assert(cond, msg) { if (!cond) throw new Error(msg); }
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const tags = src.match(/<(input|textarea)\b[^>]*>/g) || [];
  for (const tag of tags) {
    assert(/autoComplete\s*=\s*"off"|autocomplete\s*=\s*"off"/i.test(tag), `${file} missing autocomplete off: ${tag}`);
  }
}
console.log('short-link autocomplete off OK');
