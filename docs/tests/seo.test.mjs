import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const origin = 'https://react-native-swipe-deck.pages.dev';
const output = new URL('../doc_build/', import.meta.url);
const publicFiles = new Set(await readdir(new URL('../docs/public/', import.meta.url)));
const files = (await readdir(output, { recursive: true })).filter(
  (file) => file.endsWith('.html') && file !== '404.html' && !publicFiles.has(file),
);

function links(html, rel) {
  return [...html.matchAll(/<link\b[^>]*>/g)]
    .map(([tag]) =>
      Object.fromEntries(
        [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]),
      ),
    )
    .filter((attributes) => attributes.rel === rel);
}

const pages = await Promise.all(
  files.map(async (file) => {
    const html = await readFile(new URL(file, output), 'utf8');
    const pathname = `/${file}`.replace(/index\.html$/, '').replace(/\.html$/, '');
    return { file, html, url: `${origin}${pathname}` };
  }),
);

test('every document has one absolute self-canonical using the deployed clean URL', () => {
  assert.ok(pages.length > 0, 'Build the documentation before running SEO checks.');

  for (const page of pages) {
    assert.deepEqual(
      links(page.html, 'canonical'),
      [{ rel: 'canonical', href: page.url }],
      page.file,
    );
  }
});

test('English and Korean hreflang links are absolute, self-inclusive, and reciprocal', () => {
  const pagesByUrl = new Map(pages.map((page) => [page.url, page]));

  for (const page of pages) {
    const lang = page.html.match(/<html\b[^>]*\blang="([^"]+)"/)?.[1];
    assert.ok(lang === 'en' || lang === 'ko', page.file);
    const pathname = new URL(page.url).pathname;
    const englishPath = lang === 'ko' ? pathname.slice('/ko'.length) : pathname;
    const expected = [
      { rel: 'alternate', hreflang: 'en', href: `${origin}${englishPath}` },
      { rel: 'alternate', hreflang: 'ko', href: `${origin}/ko${englishPath}` },
    ];
    const alternates = links(page.html, 'alternate').filter((link) => link.hreflang);
    assert.deepEqual(alternates, expected, page.file);

    for (const alternate of alternates) {
      const target = pagesByUrl.get(alternate.href);
      assert.ok(target, `Missing document for ${alternate.href}`);
      assert.ok(
        links(target.html, 'alternate').some(
          (link) => link.hreflang === lang && link.href === page.url,
        ),
        `Missing reciprocal link from ${target.file} to ${page.file}`,
      );
    }
  }
});

test('sitemap contains exactly the canonical document URLs and is advertised in robots.txt', async () => {
  const sitemap = await readFile(new URL('sitemap.xml', output), 'utf8');
  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(sitemap, /<\/urlset>\s*$/);
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url);
  assert.equal(new Set(urls).size, urls.length, 'Sitemap URLs must be unique.');
  assert.deepEqual(urls.sort(), pages.map((page) => page.url).sort());

  const robots = await readFile(new URL('robots.txt', output), 'utf8');
  assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
});

test('404 and public verification assets are excluded from SEO document metadata', async () => {
  const notFound = await readFile(new URL('404.html', output), 'utf8');
  assert.deepEqual(links(notFound, 'canonical'), []);

  const verification = 'google72c92fa3f3368c37.html';
  assert.equal(
    await readFile(new URL(verification, output), 'utf8'),
    await readFile(new URL(`../docs/public/${verification}`, import.meta.url), 'utf8'),
  );
});
