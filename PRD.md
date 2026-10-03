# PRD: Portfolio, Writeup & Research Site

**Status:** Draft v1
**Owner:** Site author (offensive security student / junior penetration tester)
**Companion file:** `AGENTS.md` (build instructions for coding agents; this document explains the *what and why*, that one explains the *how*)

---

## 1. Summary

A personal website where the owner publishes everything they learn, find, and build in offensive security: HackTheBox writeups, CVE and bug bounty research, blog posts, and projects. A lean "about me" homepage gives hiring managers a fast first impression and lets them move into the deeper work.

## 2. Problem and opportunity

- The owner produces a steady stream of technical work (daily HTB practice, bug bounty hunting, CVE research, tooling projects), but it is scattered across platforms and not presented in one place.
- Hiring managers and recruiters have little time. They need to judge skill depth quickly, and a CV alone does not show it.
- Writing up each box, bug, and CVE builds a public record of ability and also helps the owner learn.

## 3. Goals

| Priority | Goal |
|---|---|
| 1 | **Get hired.** A recruiter or hiring manager should understand who the owner is and see evidence of skill within seconds, then be able to read deeper. |
| 2 | **Build reputation.** Make the work findable by search engines and easy for security peers to read and share. |
| 3 | **Make publishing effortless.** Writing a new post should mean adding one Markdown file and pushing to GitHub. |

## 4. Non-goals

These were considered and deliberately excluded:

- Comments or any visitor interaction (read-only site)
- Analytics or visitor tracking of any kind
- A downloadable CV/PDF
- An RSS feed
- Full-text search (title and tags only)
- A contact form or any backend
- Formal content licensing
- A polished mobile experience (functional only)

## 5. Users

**Hiring manager / recruiter (primary).** Skims. Wants to know who the owner is, what they have done, and whether they are credible. Will click into one or two writeups to check depth, then reach out.

**Security peer (secondary).** Arrives from search or a shared link looking for a specific box, technique, or CVE. Wants clear technical detail, readable code blocks, and zoomable screenshots.

**The owner (author).** Publishes frequently. Is new to Astro, so the workflow must be simple and documented.

## 6. User stories

**Hiring manager**
- As a recruiter, I want to see who the owner is and their key credentials on one page, so I can decide quickly whether to keep reading.
- As a recruiter, I want to move from the homepage into writeups, research, and projects, so I can verify the owner's skill.
- As a recruiter, I want a clear way to contact the owner, so I can reach out without hunting for it.
- As a recruiter, I want to find the owner on LinkedIn, so I can verify them and request a CV.

**Security peer**
- As a reader, I want to search a box name or technique and land on the writeup, so I can learn from it.
- As a reader, I want to filter by domain (for example Active Directory, web) and difficulty, so I find relevant posts fast.
- As a reader, I want to copy commands from code blocks and zoom into screenshots, so I can follow along.
- As a reader, I want to search the site by title or tag, so I can jump straight to what I need.

**Owner**
- As the author, I want to publish a post by adding a Markdown file and pushing to `main`, so publishing takes minutes.
- As the author, I want to write posts in any structure, so complex multi-host writeups are not forced into a template.
- As the author, I want invalid or incomplete post metadata to fail the build with a clear message, so mistakes never go live.
- As the author, I want to showcase projects I built separately from blog posts, so they get proper visibility.

## 7. Functional requirements

### 7.1 Homepage (hub)
- Hero with name, one-line role, and current status
- Short "about" section: who I am, what I do, what I do in life, what I have found
- A few proof points (for example HTB rank, certification in progress, notable CVEs or bounties), supplied by the owner
- Icon links to GitHub, HackTheBox, and LinkedIn; a "Contact me" `mailto:` link
- Clear entry points to Writeups, Research, Blog, and Projects
- A "latest posts" strip near the bottom showing the newest 3 to 5 posts across all types

### 7.2 Content sections
- **Writeups:** HackTheBox and similar walkthroughs
- **Research:** CVE reports, vulnerability research, bug bounty findings
- **Blog:** other writing, including posts that explain or review a tool
- **Projects:** a grid of things the owner built and maintains (name, description, tech, GitHub link)

### 7.3 Posts
- Each post is a freeform Markdown file with a small required frontmatter block: title, date, type (`writeup`, `research`, `tool`), one-line summary, tags, difficulty
- No required body structure
- Screenshots live next to their post and open in a click-to-zoom view
- Code blocks have syntax highlighting and a copy button

### 7.4 Listing, filtering, and search
- Each listing card shows title, tags, difficulty badge, date, and summary
- Visitors can filter by tag and by difficulty, and combine filters
- A search bar, available from the first release, matches titles and tags

### 7.5 Navigation
- Persistent slim top navbar on desktop: Home, Writeups, Research, Blog, Projects, Contact
- Hamburger menu on mobile only

### 7.6 Theming
- Dark mode by default, regardless of the visitor's system setting
- A toggle in the navbar switches to light mode
- The visitor's choice is remembered for future visits

### 7.7 Contact and privacy
- Contact is a `mailto:` link plus a LinkedIn button
- No public CV, and no personal details beyond what the owner chooses to show

### 7.8 SEO
- Titles, descriptions, and Open Graph tags generated from post metadata
- Sitemap, `robots.txt`, canonical URLs, and semantic HTML
- Goal: searching for a topic the owner has written about surfaces their page

### 7.9 Footer
- Owner's name, current year, small "built with Astro" credit

## 8. Non-functional requirements

- **Cost:** free to host (GitHub Pages) and free to deploy (GitHub Actions)
- **Deployment:** automatic on every push to `main`, no review step
- **Performance:** fast static pages, no heavy client-side frameworks
- **Accessibility:** readable contrast in both themes, keyboard-navigable, meaningful alt text
- **Privacy:** no tracking, no cookies set by the site, no personal data collected from visitors
- **Maintainability:** simple, conventional code that a beginner to Astro can follow, with a README covering running locally, adding a post, adding a project, and deployment
- **Portability:** theme colors, fonts, and spacing kept in central tokens so the Figma design can be applied later without a rewrite

## 9. Content rules

- Only publish writeups for **retired** HackTheBox machines (HTB does not permit public writeups of active ones)
- Never publish material from employer or client engagements, or vulnerabilities that are not yet responsibly disclosed
- Never invent credentials, CVE IDs, or achievements; every proof point must be real and supplied by the owner
- Tags use lowercase kebab-case and a consistent vocabulary

## 10. Success criteria

There is no analytics by design, so success is checked manually.

**At launch**
- The site builds and deploys automatically from `main`
- Adding a correctly formatted Markdown file makes a post appear in the right listing, with no code changes
- Search returns a post when its title or tag is typed
- Both themes work, and the dark default holds on first visit
- Shared links show a correct preview on LinkedIn

**Quality bar (proposed targets, adjust as needed)**
- Lighthouse scores of 90+ for Performance, Accessibility, and SEO on the homepage and a post page

**After launch (qualitative)**
- Searching a published box name in a search engine eventually surfaces the owner's writeup
- Recruiters or peers reach out via LinkedIn or email referencing the site

## 11. Release plan

| Phase | Scope | Exit condition |
|---|---|---|
| **1: Foundation** | Layout, navbar, footer, theming, content collections and validation, listing pages with filtering, post pages, hub page, projects page, one labeled sample post per type, deploy workflow, README | Site builds, deploys, and shows sample content in both themes; adding a Markdown file publishes a post |
| **2: Discovery** | Search, SEO, copy buttons, image lightbox | Search finds sample posts; meta tags and link previews correct; code and image features work |
| **3: Hardening** | Mobile pass, accessibility check, README finalized | Readable on mobile, Lighthouse targets met |
| **Owner-driven** | Apply the Figma design, replace samples with real content, add a custom domain | Real content live under the owner's own design |

Each phase ends with an owner review before the next begins.

## 12. Dependencies and assumptions

- A GitHub account and a repository for the site
- Astro as the framework, GitHub Pages as host, Pagefind for search, Shiki for highlighting
- The owner supplies all personal content (bio, proof points, links, email)
- The visual design does not exist yet; the owner will generate it separately in Figma

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Publishing a writeup for an active HTB machine | Content rule in section 9; optional `draft` flag keeps unfinished posts out of the build |
| Accidentally exposing sensitive or undisclosed findings | Content rule in section 9; owner reviews before every publish |
| Owner is new to Astro and gets stuck | Conventional patterns, comments, README, phased delivery with review |
| Design not ready when the build starts | Central style tokens; design applied after Phase 3 |
| Public email address attracts spam | Use a dedicated address for the site; the owner accepted this trade-off |
| Scope creep from excluded features | Non-goals list in section 4 and `AGENTS.md` |

## 14. Open questions

- Final bio text and proof points
- Public email address for the contact link
- Exact GitHub, HackTheBox, and LinkedIn URLs
- Which projects are public (for example whether the challenge platform is shown)
- Final tag vocabulary
- Default image for link previews
- Final visual design (Figma)
- Timing and name of the custom domain
