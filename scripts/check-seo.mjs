import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const publicUrl = 'https://ruan2r.github.io/P19-CENTRAL-DEMO-2R/';
const requiredFiles = ['index.html', 'robots.txt', 'sitemap.xml', 'favicon.svg', '2r-logo.png'];

function fail(message) {
  console.error('SEO check failed:', message);
  process.exitCode = 1;
}

for (const file of requiredFiles) {
  if (!existsSync(join(dist, file))) fail(`Arquivo ausente em dist/: ${file}`);
}

if (process.exitCode) process.exit(1);

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const robots = readFileSync(join(dist, 'robots.txt'), 'utf8');
const sitemap = readFileSync(join(dist, 'sitemap.xml'), 'utf8');

const checks = [
  ['title', /<title>2R Informática \| Sistemas de Gestão e Aplicações Web<\/title>/i.test(html)],
  ['meta description', /<meta name="description" content="[^"]{80,200}"\s*\/>/i.test(html)],
  ['canonical', html.includes(`<link rel="canonical" href="${publicUrl}"`)],
  ['Open Graph', html.includes('property="og:title"') && html.includes('property="og:description"') && html.includes('property="og:image"')],
  ['Twitter Card', html.includes('name="twitter:card"') && html.includes('name="twitter:image"')],
  ['robots index', /<meta name="robots" content="index,follow/i.test(html)],
  ['JSON-LD', /<script type="application\/ld\+json">[\s\S]*?"@type": "Organization"[\s\S]*?"@type": "WebSite"[\s\S]*?<\/script>/.test(html)],
  ['robots.txt allow', /User-agent:\s*\*\s*Allow:\s*\//i.test(robots)],
  ['robots sitemap', robots.includes(`Sitemap: ${publicUrl}sitemap.xml`)],
  ['sitemap URL', sitemap.includes(`<loc>${publicUrl}</loc>`)],
  ['favicon link', /rel="icon" type="image\/svg\+xml" href="[^"]*favicon\.svg"/i.test(html)],
  ['social image asset', html.includes(`${publicUrl}2r-logo.png`)]
];

for (const [label, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} SEO: ${label}`);
  if (!passed) process.exitCode = 1;
}

if (process.exitCode) process.exit(1);
console.log('SEO static checks passed.');
