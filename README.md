# Security portfolio

An Astro static site for writeups, research, blog posts, and projects. The Writeups section contains 15 migrated real articles. Research, Blog, and Projects still contain clearly marked **SAMPLE** entries; personal fields remain `TODO(owner)` placeholders.

## Run locally

Requires Node.js 22 or newer.

```sh
npm install
npm run dev
```

Open the local URL printed by Astro. To check the production output:

```sh
npm run check
npm run build
npm test
npm run preview
```

The build runs Astro and then Pagefind. **Search works in the production preview or deployed site after a build**; `npm run dev` does not generate the Pagefind index.

Search covers **post titles and tags only**. Markdown prose, headings, code, summaries, and screenshots are not indexed.

## Add a post

Create `src/content/posts/writeups/my-box/index.md` with this frontmatter and freeform Markdown below it:

```md
---
title: "My retired box"
date: 2026-10-03
type: writeup
summary: "A one-line summary."
tags: ["active-directory", "kerberos"]
difficulty: medium
---

Your post starts here.
```

For a research post, use `src/content/posts/research/my-topic/index.md` and `type: research`. For a blog post that explains or reviews a tool, use `src/content/posts/blog/my-topic/index.md` and `type: tool`. Tools you built belong in Projects. The required fields are `title`, `date`, `type`, `summary`, and `tags`. Include `difficulty: easy`, `medium`, or `hard` for a machine when its source states a rating; omit it for unrated web challenges. Tags must be lowercase kebab-case. The folder name becomes the URL slug, and the `type` must match its folder.

Put images in an `images/` folder beside that `index.md` and link with `![Meaningful alt text](./images/example.png)`. `draft: true` keeps an unfinished post out of listings and routes. Only publish writeups for retired HackTheBox machines and only publish findings that are cleared for disclosure. The clearly labeled SAMPLE research and blog posts are separate from the migrated writeups.

## Add a project

Create a Markdown file such as `src/content/projects/my-project.md`:

```md
---
name: "My public project"
description: "What it does in one sentence."
tech: ["Astro", "TypeScript"]
repo: "https://github.com/your-name/your-repo"
status: "Maintained"
---
```

The repository URL is optional. Confirm a project is public before adding it. The site currently shows only SAMPLE project placeholders.

## Post reading features

Astro highlights fenced code blocks with Shiki. Each block has a keyboard-accessible copy button that shows confirmation. Article images open in a dialog by click, Enter, or Space; Escape, the close button, and a click outside the image dismiss it. Give every Markdown image meaningful alt text.

## Deployment

The workflow at `.github/workflows/deploy.yml` builds and deploys on every push to `main`. This project is in the existing `sbouabid-sec/sbouabid-sec.github.io` repository. The production URL is `https://sbouabid-sec.github.io`. Before the first deployment, confirm GitHub Pages uses **GitHub Actions** as its source. The workflow derives the site URL from the repository owner. A custom domain can be configured later. No deployment has been performed during launch preparation.

Every page has a canonical URL, description, and Open Graph metadata. The build produces `sitemap.xml` and `robots.txt`. Replace `public/og-placeholder.png` with an owner-provided image before publishing final content; its editable SVG source is beside it.

## Owner details to supply

Replace the `TODO(owner)` placeholders for the name, one-line status, bio, proof points, public email, GitHub/HackTheBox/LinkedIn URLs, public project choices and details, default Open Graph image, and final tag vocabulary. Replace SAMPLE research and blog posts with the owner's cleared, publishable work. The approved V5 design is already implemented. The light/dark choice is saved in browser local storage; a first visit always starts dark.

## Dependency audit

Astro 7.3.5 currently pulls in `http-cache-semantics` 4.2.0, which has an unresolved high-severity advisory ([GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp)). No patched version is published. The current site builds static files for GitHub Pages and does not ship this dependency to browsers; Astro uses it during remote-image handling. Recheck `npm audit --omit=dev` and upgrade when an Astro-compatible fix is available. Do not use `npm audit fix --force` without reviewing the dependency changes.
