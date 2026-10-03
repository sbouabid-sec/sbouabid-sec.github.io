import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const output = new URL('../dist/', import.meta.url);
const read = (path) => readFileSync(new URL(path, output), 'utf8');

test('post pages publish their own canonical and social metadata', () => {
  const html = read('writeups/forest/index.html');
  assert.match(html, /<link rel="canonical" href="https:\/\/sbouabid-sec\.github\.io\/writeups\/forest\/"/);
  assert.match(html, /<meta property="og:title" content="SAMPLE — Forest \| TODO\(owner\): NAME"/);
  assert.match(html, /<meta property="og:description" content="A fictional retired-box walkthrough used to demonstrate the reading layout\."/);
  assert.match(html, /<meta property="og:type" content="article"/);
  assert.match(html, /<meta property="og:image" content="https:\/\/sbouabid-sec\.github\.io\/og-placeholder\.png"/);
});

test('section pages have distinct descriptions for shared-link previews', () => {
  const paths = ['index.html', 'writeups/index.html', 'research/index.html', 'blog/index.html', 'projects/index.html'];
  const descriptions = paths.map((path) => read(path).match(/<meta name="description" content="([^"]+)"/)?.[1]);
  assert.equal(new Set(descriptions).size, paths.length);
  for (const description of descriptions) assert.ok(description && description.length > 40);
});

test('robots and sitemap expose every public post route', () => {
  assert.match(read('robots.txt'), /Sitemap: https:\/\/sbouabid-sec\.github\.io\/sitemap\.xml/);
  assert.match(read('sitemap.xml'), /sitemap-0\.xml/);
  assert.match(read('sitemap-index.xml'), /sitemap-0\.xml/);
  const sitemap = read('sitemap-0.xml');
  for (const path of ['/writeups/forest/', '/research/authentication-study/', '/blog/bloodhound-workflow/']) {
    assert.ok(sitemap.includes(`https://sbouabid-sec.github.io${path}`), path);
  }
});

test('production build contains a static Pagefind bundle', () => {
  assert.ok(existsSync(new URL('pagefind/pagefind.js', output)));
});
