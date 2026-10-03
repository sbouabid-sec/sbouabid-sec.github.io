import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '**/index.md' }),
  schema: z.object({
    title: z.string().min(1),
    date: z.coerce.date(),
    type: z.enum(['writeup', 'research', 'tool']),
    summary: z.string().min(1),
    tags: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Tags must use lowercase kebab-case')).min(1),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    draft: z.boolean().default(false),
  }),
});

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '*.md' }),
  schema: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    tech: z.array(z.string()).min(1),
    repo: z.url().optional(),
    status: z.string().min(1),
    sample: z.boolean().default(false),
  }),
});

export const collections = { posts, projects };
