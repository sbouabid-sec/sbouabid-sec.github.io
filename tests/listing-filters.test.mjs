import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { humanizeTag, displayTag, isCveTag } from '../src/lib/tags.mjs';

const dist = new URL('../dist/', import.meta.url);
const readOutput = (path) => readFileSync(new URL(path, dist), 'utf8');
const listings = ['writeups/index.html', 'research/index.html', 'blog/index.html'];

// Values and post counts of the tag picker options, in page order.
function pickerOptions(html) {
  const values = [...html.matchAll(/data-tag-option="([^"]+)"/g)].map((match) => match[1]);
  const counts = [...html.matchAll(/<span class="tag-count">(\d+)<\/span>/g)].map((match) => Number(match[1]));
  assert.equal(counts.length, values.length);
  return values.map((value, index) => ({ value, count: counts[index] }));
}

test('tag labels are humanized without changing the underlying values', () => {
  assert.equal(humanizeTag('active-directory'), 'Active Directory');
  assert.equal(humanizeTag('sql-injection'), 'SQL Injection');
  assert.equal(humanizeTag('dns-hijacking'), 'DNS Hijacking');
  assert.equal(humanizeTag('ntlm-relay'), 'NTLM Relay');
  assert.equal(humanizeTag('spn-hijacking'), 'SPN Hijacking');
  assert.equal(humanizeTag('kerberoasting'), 'Kerberoasting');
  assert.equal(humanizeTag('privilege-escalation'), 'Privilege Escalation');
  for (const word of ['aws', 'csrf', 'json', 'ldap', 'php', 'smb', 'ssrf', 'xss', 'xssi']) {
    assert.equal(humanizeTag(word), word.toUpperCase());
  }
  assert.equal(humanizeTag('crushftp'), 'CrushFTP');
  assert.equal(humanizeTag('sebackupprivilege'), 'SeBackupPrivilege');
  assert.equal(humanizeTag('localstack'), 'LocalStack');
  assert.equal(humanizeTag('diskshadow'), 'DiskShadow');
  assert.equal(humanizeTag('winrm'), 'WinRM');
  assert.equal(humanizeTag('ci-cd'), 'CI/CD');
  assert.equal(humanizeTag('php-cgi'), 'PHP-CGI');
});

test('CVE-ID tags are detected and left raw on posts', () => {
  for (const tag of ['cve-2025-64459', 'cve-2025-32433', 'cve-2025-31161', 'cve-2024-5932']) {
    assert.equal(isCveTag(tag), true);
    assert.equal(displayTag(tag), tag);
  }
  for (const tag of ['web', 'csrf', 'active-directory', 'cve-fix-notes']) {
    assert.equal(isCveTag(tag), false);
  }
});

test('built listing pages contain no native select filter controls', () => {
  for (const path of listings) {
    assert.doesNotMatch(readOutput(path), /<select[\s>]/, path);
  }
});

test('difficulty is a segmented button group with pressed state', () => {
  for (const path of listings) {
    const html = readOutput(path);
    // Astro renders the empty value as a bare attribute.
    assert.ok(html.includes('data-difficulty-value aria-pressed="true"'), `${path}: all`);
    for (const value of ['easy', 'medium', 'hard']) {
      assert.ok(html.includes(`data-difficulty-value="${value}"`), `${path}: ${value}`);
    }
    assert.match(html, /data-difficulty-value[\s>]aria-pressed="true"/, path);
  }
});

test('the writeups picker lists 45 usage-sorted tags and no CVE IDs', () => {
  const options = pickerOptions(readOutput('writeups/index.html'));
  // 49 unique tags in the writeups content, 4 of which look like CVE IDs.
  assert.equal(options.length, 45);
  assert.deepEqual(options.slice(0, 2), [
    { value: 'active-directory', count: 5 },
    { value: 'web-security', count: 3 },
  ]);
  for (const option of options) {
    assert.equal(isCveTag(option.value), false, option.value);
  }
  const sorted = [...options].sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : 1));
  assert.deepEqual(options, sorted);
});

test('CVE-ID tags stay on the posts even though the picker hides them', () => {
  const html = readOutput('writeups/index.html');
  for (const tag of ['cve-2025-64459', 'cve-2025-32433', 'cve-2025-31161', 'cve-2024-5932']) {
    assert.ok(html.includes(tag), tag);
  }
});

test('smaller listings still render a picker without CVE IDs', () => {
  assert.deepEqual(
    pickerOptions(readOutput('research/index.html')).map((option) => option.value).sort(),
    ['authentication', 'web'],
  );
  assert.deepEqual(
    pickerOptions(readOutput('blog/index.html')).map((option) => option.value).sort(),
    ['active-directory', 'tooling'],
  );
});
