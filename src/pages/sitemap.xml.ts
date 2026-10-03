import type { APIRoute } from 'astro';

// The official sitemap integration writes sitemap-0.xml; this stable URL points to it.
export const GET: APIRoute = ({ site }) => {
  const location = new URL('sitemap-0.xml', site ?? 'https://sbouabid-sec.github.io');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${location.href}</loc></sitemap></sitemapindex>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
