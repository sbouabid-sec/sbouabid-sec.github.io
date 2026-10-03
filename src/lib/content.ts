import { getCollection, type CollectionEntry } from 'astro:content';
import { sectionForType, sortNewest } from './posts.mjs';

export async function publishedPosts(): Promise<CollectionEntry<'posts'>[]> {
  const posts = await getCollection('posts', ({ data }) => !data.draft);

  for (const post of posts) {
    const folder = post.id.split('/')[0];
    const expected = sectionForType(post.data.type);
    if (folder !== expected) {
      throw new Error(`Post ${post.id}: folder "${folder}" conflicts with type "${post.data.type}". Move it to posts/${expected}/.`);
    }
  }

  return sortNewest(posts);
}
