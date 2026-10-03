import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPosts, sortNewest, postUrl, sectionForType } from '../src/lib/posts.mjs';

const posts = [
  { id: 'writeups/forest', data: { type: 'writeup', title: 'Forest', tags: ['active-directory'], difficulty: 'medium', date: new Date('2026-10-02') } },
  { id: 'writeups/hard-box', data: { type: 'writeup', title: 'Hard box', tags: ['active-directory'], difficulty: 'hard', date: new Date('2026-09-29') } },
  { id: 'research/auth', data: { type: 'research', title: 'Authentication study', tags: ['web'], difficulty: 'hard', date: new Date('2026-09-28') } },
];

test('tag and difficulty filters combine', () => {
  assert.deepEqual(filterPosts(posts, { tag: 'active-directory', difficulty: 'hard' }).map((post) => post.data.title), ['Hard box']);
});

test('each filter works independently', () => {
  assert.equal(filterPosts(posts, { tag: 'web' }).length, 1);
  assert.equal(filterPosts(posts, { difficulty: 'hard' }).length, 2);
});

test('newest posts sort first without changing source order', () => {
  const reversed = [...posts].reverse();
  assert.deepEqual(sortNewest(reversed).map((post) => post.data.title), ['Forest', 'Hard box', 'Authentication study']);
  assert.equal(reversed[0].data.title, 'Authentication study');
});

test('post URLs derive from type and directory, not page code', () => {
  assert.equal(postUrl(posts[0]), '/writeups/forest/');
  assert.equal(postUrl(posts[2]), '/research/auth/');
  assert.equal(sectionForType('tool'), 'blog');
});
