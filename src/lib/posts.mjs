const sections = { writeup: 'writeups', research: 'research', tool: 'blog' };

export function sectionForType(type) {
  return sections[type];
}

export function filterPosts(posts, { tag = '', difficulty = '' } = {}) {
  return posts.filter((post) =>
    (!tag || post.data.tags.includes(tag)) &&
    (!difficulty || post.data.difficulty === difficulty)
  );
}

export function sortNewest(posts) {
  return [...posts].sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function postSlug(post) {
  return post.id.split('/').at(-1);
}

export function postUrl(post) {
  return `/${sectionForType(post.data.type)}/${postSlug(post)}/`;
}
