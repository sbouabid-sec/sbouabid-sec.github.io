import test from 'node:test';
import assert from 'node:assert/strict';
import { codeBlockPresentation } from '../src/lib/code-blocks.mjs';

test('shell and console languages receive terminal presentation', () => {
  for (const language of ['bash', 'shell', 'sh', 'zsh', 'powershell', 'console', 'cmd']) {
    assert.deepEqual(codeBlockPresentation(language), { kind: 'terminal', label: language });
  }
});

test('source and configuration languages receive editor presentation', () => {
  for (const language of ['javascript', 'python', 'yaml', 'json', 'php', 'sql']) {
    assert.deepEqual(codeBlockPresentation(language), { kind: 'editor', label: language });
  }
});

test('missing and unknown languages use a readable code label', () => {
  assert.deepEqual(codeBlockPresentation(''), { kind: 'editor', label: 'text' });
  assert.deepEqual(codeBlockPresentation(undefined), { kind: 'editor', label: 'text' });
  assert.deepEqual(codeBlockPresentation('custom-lang'), { kind: 'editor', label: 'custom-lang' });
});
