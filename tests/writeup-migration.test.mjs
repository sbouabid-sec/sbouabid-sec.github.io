import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const slugs = [
  'nimbus', 'pirate', 'garfield', 'build', 'giveback', 'gavel', 'imagery',
  'soulmate', 'infection', 'active', 'cicada', 'timelapse',
  'csp-bypass-xss', 'json-csrf', 'xssi',
  'codeparttwo', 'titanic', 'linkvortex', 'code', 'conversor', 'permx',
  'forgotten', 'escape',
];
const dist = new URL('../dist/', import.meta.url);
const writeups = new URL('../src/content/posts/writeups/', import.meta.url);
const readOutput = (path) => readFileSync(new URL(path, dist), 'utf8');

test('the selected writeups publish 23 real routes and replace Forest', () => {
  const folders = readdirSync(writeups, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(new URL(`${entry.name}/index.md`, writeups)))
    .map((entry) => entry.name).sort();
  assert.deepEqual(folders, [...slugs].sort());
  for (const slug of slugs) {
    assert.ok(existsSync(new URL(`writeups/${slug}/index.html`, dist)), slug);
  }
  assert.equal(existsSync(new URL('writeups/forest/index.html', dist)), false);
  const listing = readOutput('writeups/index.html');
  assert.equal((listing.match(/class="post-row"/g) ?? []).length, 23);
  assert.doesNotMatch(listing, /SAMPLE CONTENT|SAMPLE entries/);
});

test('real articles omit SAMPLE labels and unrated challenges omit difficulty badges', () => {
  for (const slug of slugs) {
    const html = readOutput(`writeups/${slug}/index.html`);
    assert.doesNotMatch(html, /SAMPLE CONTENT/);
    assert.match(html, new RegExp(`https://sbouabid-sec\\.github\\.io/writeups/${slug}/`));
  }
  for (const slug of ['csp-bypass-xss', 'json-csrf', 'xssi']) {
    const html = readOutput(`writeups/${slug}/index.html`);
    assert.doesNotMatch(html, /class="difficulty/);
  }
  assert.match(readOutput('research/authentication-study/index.html'), /SAMPLE CONTENT/);
});

test('migrated image references stay local and every copied file is used', () => {
  for (const slug of slugs) {
    const folder = new URL(`${slug}/`, writeups);
    const markdown = readFileSync(new URL('index.md', folder), 'utf8');
    assert.doesNotMatch(markdown, /\/assets\/img\/(box|writeup-img)\//);
    assert.doesNotMatch(markdown, /img\.shields\.io|logo\.png/i);
    const refs = [...markdown.matchAll(/!\[[^\]]+\]\(\.\/images\/([^\)]+)\)/g)].map((match) => match[1]);
    const images = new URL('images/', folder);
    for (const ref of refs) assert.ok(existsSync(new URL(ref, images)), `${slug}: ${ref}`);
    if (existsSync(images)) {
      assert.deepEqual(readdirSync(images).sort(), [...new Set(refs)].sort(), slug);
    } else {
      assert.equal(refs.length, 0, slug);
    }
  }
});
