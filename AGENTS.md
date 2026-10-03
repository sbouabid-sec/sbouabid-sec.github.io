# AGENTS.md

Instructions for any coding agent working on this repository. Read this whole file before writing code. It is the source of truth for what to build.

---

## 0. Working rules for the agent

1. **Decisions are final.** Anything marked **DECIDED** was chosen by the owner. Do not swap it for something you think is better. If you believe a decision is a mistake, say so in your reply and keep building what was decided.
2. **Suggestions are flexible.** Anything marked **SUGGESTED** is an implementation hint. You may change it if you have a better way, but tell the owner what you changed and why.
3. **Do not build excluded features** (section 14), even if they seem helpful.
4. **Never invent personal content.** Bio text, ranks, CVE IDs, bounty results, email address, and profile URLs are supplied by the owner. Use clearly marked placeholders: `TODO(owner): ...`. Sample posts must be obviously fake and labeled as samples.
5. **No private information on the site.** No phone number, home address, or anything personal beyond what the owner provides. Never include content from employer or client engagements or undisclosed vulnerabilities.
6. **The owner is new to Astro.** Prefer plain, conventional Astro patterns over clever ones. Keep components small, comment anything non-obvious, and keep dependencies minimal. Explain any dependency you add.
7. **Work in phases (section 15).** Finish a phase, summarize what exists and how to run it, then stop and wait for the owner's review before starting the next phase.
8. **Keep a README** that explains: how to run the site locally, how to add a post, how to add a project, and how deployment works.

---

## 1. Project overview

A personal portfolio, blog, writeup, and research website for an offensive security student and junior penetration tester.

**What gets published:**
- HackTheBox writeups (the owner plays HTB daily and writes a writeup for each box they learn)
- A report for every CVE or bug found
- Research posts and posts explaining tools
- A showcase of projects the owner built and maintains

**Goals (DECIDED):**
- Primary: **get hired**
- Secondary: **build reputation** in the security community

**Audience:**
- Hiring managers and HR: they skim. The first impression has to land in seconds, and then they should be able to move into the writeups, research, and projects.
- Security peers: they want to read technical depth and follow the work.

---

## 2. Decisions at a glance

| Area | Decision |
|---|---|
| Framework | Astro (static site) |
| Hosting | GitHub Pages |
| Deploy | GitHub Actions, auto-deploy on every push to `main` |
| Content format | Freeform Markdown + small frontmatter block |
| Content storage | Markdown files in the site's own repo |
| Organization | Filterable tags (domain/vuln type) + difficulty, not rigid folders |
| Search | Included from v1, title and tags only |
| Homepage | Lean "about me" hub, separate sections for everything else |
| Theme | Dark by default, light toggle, choice remembered |
| Contact | `mailto:` link + LinkedIn button, no public CV |
| Design | Not final: loose direction now, Figma design later |
| Mobile | Functional, not polished |
| SEO | Built in from day one |
| URL | Default `github.io` URL now, custom domain later |
| Analytics, comments, RSS | None |

---

## 3. Tech stack

- **Framework:** Astro
- **Hosting:** GitHub Pages
- **Deploy:** GitHub Actions on push to `main`
- **Content:** Markdown with frontmatter, validated by Astro content collections
- **Search:** Pagefind (static, indexed at build time)
- **Syntax highlighting:** Shiki (built into Astro)
- **Styling:** SUGGESTED: plain CSS with CSS variables for theme tokens, so the Figma design can be applied later by changing tokens and a few components. Avoid heavy UI frameworks.

---

## 4. Site map and navigation

**Routes (DECIDED):**
- `/` Home (the "about me" hub)
- `/writeups` listing, `/writeups/<slug>` post
- `/research` listing, `/research/<slug>` post
- `/blog` listing, `/blog/<slug>` post
- `/projects` showcase grid
- Contact: a `mailto:` link reachable from the nav and the hub (not a separate page)

**Navigation (DECIDED):**
- Persistent, slim top navbar on every page with text links: Home, Writeups, Research, Blog, Projects, Contact
- The theme toggle button lives in the navbar
- Hamburger menu on mobile only. Desktop always shows the full nav.

**What each section is for:**
- **Writeups:** HackTheBox boxes and similar walkthroughs
- **Research:** CVE reports, vulnerability research, bug bounty findings
- **Blog:** anything else the owner wants to write, including posts that explain or review a tool someone else made
- **Projects:** things the owner built and maintains (for example the bug bounty recon skill package and the hacking challenge platform). These are showcased as a grid, not as blog posts.

---

## 5. Homepage (the hub)

The hub is where a hiring manager lands. Keep it tight and credibility-dense, not a wall of text.

**Order of sections:**
1. **Hero:** name, one-line role, current status (student, junior penetration tester)
2. **About:** short answers to: who am I, what do I do, what do I do in life, what have I found. `TODO(owner): bio text`
3. **Proof points:** a few hard facts, for example HTB rank, certification in progress, notable CVEs or bounties. `TODO(owner): supply real values. Do not invent any.`
4. **Links:** icon links to GitHub, HackTheBox profile, LinkedIn, plus a "Contact me" `mailto:` link. `TODO(owner): URLs and public email address`
5. **Section links:** clear entry points to Writeups, Research, Blog, and Projects so a visitor can "swipe" into whichever they want
6. **Latest posts strip (near the bottom):** the latest 3 to 5 posts, mixing all content types. The bio and proof points stay first.

**Contact and CV (DECIDED):**
- Contact is a simple `mailto:` link. No contact form, no backend.
- **No downloadable CV/PDF on the site.** Reason: a public PDF gets scraped and indexed, exposing personal details. Interested people reach the owner through LinkedIn or email and request a CV privately.

---

## 6. Content model

**One unified content collection (DECIDED).** Writeups, research, and blog/tool posts share the same schema and the same tag and filter system. The `type` field says which kind each post is.

**Each post is a freeform Markdown file (DECIDED).** Do not enforce a body template. Some writeups (for example multi-host Active Directory chains) do not fit a fixed recon / exploit / privesc shape, and the owner wants to write them however fits. Only the frontmatter is enforced.

**Required frontmatter (DECIDED):**

```yaml
---
title: "Forest"
date: 2026-10-02
type: writeup            # writeup | research | tool
summary: "One-line summary shown on listing cards."
tags: ["active-directory", "kerberos"]
difficulty: medium       # easy | medium | hard
---
```

Notes:
- `type: tool` means a post that **explains or reviews a tool** (for example "how I use BloodHound"). Tools the owner built go in Projects, not here. Posts with `type: tool` appear under `/blog`.
- `tags` describe the vulnerability class or domain (for example `active-directory`, `web`). Use lowercase kebab-case.
- `difficulty` is its own field so it can be shown as a badge and filtered. It matters most for writeups. SUGGESTED: make it optional for `research` and `tool` posts.
- SUGGESTED: add an optional `draft: true` field. Draft posts are excluded from the build, so unfinished writeups never go live. (Reason: HackTheBox only permits public writeups of retired machines, so the owner may want to prepare posts before publishing.)

**Validate frontmatter with a schema.** Invalid or missing fields must fail the build with a readable error.

**File layout (DECIDED, with one adaptation):** content lives in the repo and is edited directly in Git. Use Astro's `src/content/` directory as the content root (this is the "content folder" from the plan, adapted to Astro's convention so images are processed correctly). SUGGESTED structure:

```
src/content/
  posts/
    writeups/
      forest/
        index.md
        images/
    research/
    blog/
  projects/
    recon-skill-package.md
    hacking-challenge-platform.md
```

Images and screenshots are **co-located with each post** (`images/` next to `index.md`). Do not use one shared global images folder. The `type` field in frontmatter is authoritative. SUGGESTED: add a check that fails the build if a post's folder and its `type` disagree.

**Projects collection (DECIDED):** a separate collection. SUGGESTED fields: `name`, `description`, `tech` (list), `repo` (GitHub URL), `status`. `TODO(owner): decide which projects are public before publishing any.` Do not assume every project is public.

---

## 7. Listing pages and filtering

Applies to `/writeups`, `/research`, and `/blog`.

**Each card shows (DECIDED):** title, tags, difficulty badge, date, one-line summary. Nothing else.

**Filtering (DECIDED):** visitors can filter by tag (domain / vulnerability type) and by difficulty (easy / medium / hard). A visitor looking for Active Directory content should not also have to know the difficulty. Filters combine.

SUGGESTED: reflect the active filters in the URL query string so filtered views can be linked.

**Sorting:** newest first.

---

## 8. Search

**DECIDED:** a search bar is included **from v1**, not deferred. It matches **titles and tags only**, not full post content (so code snippets and commands are not indexed).

SUGGESTED implementation: Pagefind, indexed at build time. To limit indexing to titles and tags, do not mark the post body as indexable; expose only the title and tags to Pagefind (for example in a visually hidden element marked with `data-pagefind-body`). Add Pagefind to the build script (`astro build && pagefind --site dist`). Note that the search index only exists after a build, so search will not work in `astro dev` until a build has run. Document this in the README.

---

## 9. Post page features

- **Syntax highlighting** with Shiki (DECIDED)
- **Copy-to-clipboard button** on every code block (DECIDED)
- **Click-to-zoom lightbox** for images and screenshots (DECIDED). Reason: security writeups often have screenshots with small but critical text (a flag, a response header). SUGGESTED: keyboard accessible, closes on Escape and on outside click.
- Readable typography for long technical posts, with proper heading hierarchy
- Wide content (code blocks, tables) scrolls horizontally inside its own container and never breaks the page layout

---

## 10. Theming

**DECIDED:**
- Two modes: **dark and light**
- A **toggle button in the top navbar**
- The site **always starts in dark mode**, regardless of the visitor's OS preference
- Once a visitor manually switches, their choice is **remembered in browser storage** and used on later visits until they switch again

SUGGESTED: set the theme with a tiny inline script in `<head>` that reads storage and sets `data-theme` on `<html>` before first paint, so there is no flash of the wrong theme. Define colors as CSS variables per theme.

**Visual direction (loose, NOT final):** dark-mode-first, monospace accents for code and tags, one sharp accent color (for example terminal green or electric blue), minimal and spacious layout. The final design will be produced later in Figma and applied afterward, so keep colors, fonts, and spacing in central tokens that are easy to change. Do not spend effort on elaborate visual polish.

---

## 11. Mobile

**DECIDED: functional-first, not polished.** The audience is overwhelmingly on desktop.
- Text must be readable
- The nav collapses to a hamburger below a breakpoint
- Code blocks scroll horizontally
- Images never overflow the screen
- Nothing breaks. Do not invest in pixel-perfect mobile design.

---

## 12. SEO

**DECIDED: built in from day one, not retrofitted.** The goal is that someone searching for a topic the owner has written about (for example an HTB box name) finds the owner's page.

- Page `<title>` and meta description generated from each post's frontmatter (`title`, `summary`)
- Open Graph tags (title, description, type, URL, image) so links look good when shared on LinkedIn and X. SUGGESTED: a default OG image for pages without one. `TODO(owner): provide default OG image`
- `sitemap.xml` generated automatically (SUGGESTED: `@astrojs/sitemap`)
- `robots.txt` that allows indexing and points to the sitemap
- Semantic HTML: one `<h1>` per page, a logical heading hierarchy, landmark elements, and meaningful `alt` text on images
- Canonical URLs

---

## 13. Deployment

**DECIDED:** GitHub Actions deploys to GitHub Pages automatically on every push to `main`. No pull-request review step (solo author). A typo is fixed by pushing again.

SUGGESTED:
- Workflow at `.github/workflows/deploy.yml` using the official `withastro/action` and `actions/deploy-pages`, with `pages: write` and `id-token: write` permissions
- Repo named `<github-username>.github.io`, so no `base` path is needed. Set `site` in `astro.config` to `https://<github-username>.github.io`. `sbouabid-sec` (confirmed by owner)
- The `build` script runs Astro then Pagefind
- **Custom domain is planned for later, not now.** When it happens: add `public/CNAME` and update `site` in the config. Keep the config easy to change.

---

## 14. Explicitly excluded (decided against, do not build)

- **No comments or feedback widget.** Read-only site for v1.
- **No analytics or visitor tracking** of any kind.
- **No downloadable CV/PDF.**
- **No RSS feed.**
- **No full-text search.** Title and tags only.
- **No contact form or backend.** `mailto:` only.
- **No formal content licensing or license text.**
- **No newsletter, popups, or cookie banners.** (Nothing here sets tracking cookies.)

Footer (DECIDED): minimal. Owner's name, current copyright year (generated, not hardcoded), and a small "built with Astro" credit.

---

## 15. Build phases

Stop after each phase and wait for the owner's review.

### Phase 1: Foundation
- Astro project with the folder layout from section 6
- Base layout, navbar (with mobile hamburger), and footer
- Theme system: dark default, light toggle, choice remembered
- Content collections with validated schemas (posts and projects)
- Listing pages with cards (title, tags, difficulty badge, date, summary) and tag/difficulty filtering
- Post page with Shiki highlighting
- Hub page with placeholder content and the latest-posts strip
- Projects page with sample entries
- **One clearly labeled sample post per type** (`writeup`, `research`, `tool`) and a sample project or two
- GitHub Actions deploy workflow, so the owner can see it live early
- README

**Done when:** the site builds, deploys, and shows sample content in both themes, and adding a Markdown file to the right folder makes it appear in the right listing.

### Phase 2: Discovery and polish of posts
- Search (Pagefind, title and tags only)
- SEO: meta tags, Open Graph, sitemap, robots.txt, canonical URLs
- Copy-to-clipboard buttons on code blocks
- Click-to-zoom lightbox for images

**Done when:** searching a sample post title or tag finds it, shared-link previews and meta tags look right, and code blocks and images behave as described in section 9.

### Phase 3: Hardening
- Mobile pass (section 11)
- Basic accessibility check: contrast in both themes, keyboard navigation, alt text
- README updated to match the final state

### Later, owner-driven (not part of the agent's initial work)
- Apply the Figma design
- Replace samples with real content
- Custom domain

---

## 16. Open items the owner must provide

- `TODO(owner)` Bio text for the hub
- `TODO(owner)` Proof points (rank, certification status, notable CVEs or bounties)
- `TODO(owner)` Public email address for the `mailto:` link
- `TODO(owner)` GitHub, HackTheBox, and LinkedIn URLs
- `TODO(owner)` Which projects are public
- GitHub username: `sbouabid-sec` (confirmed by owner; site URL `https://sbouabid-sec.github.io`)
- `TODO(owner)` Default Open Graph image
- `TODO(owner)` Final Figma design
- `TODO(owner)` Final tag vocabulary (the agent should keep tags consistent and lowercase kebab-case until then)
