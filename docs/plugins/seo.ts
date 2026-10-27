import type { RouteMeta, RspressPlugin, UserConfig } from '@rspress/core';

import { normalizeHref, withBase, withSiteOrigin } from '@rspress/core';
import { writeFile } from 'node:fs/promises';
import * as path from 'node:path';

export type AlternateLink = {
  rel: 'alternate';
  hreflang: string;
  href: string;
};

export function seoPlugin(): RspressPlugin {
  let siteConfig: UserConfig = {};
  let routes: RouteMeta[] = [];
  const pageUrl = (routePath: string) =>
    withSiteOrigin(
      withBase(
        normalizeHref(routePath, siteConfig.route?.cleanUrls ?? false),
        siteConfig.base ?? '/',
      ),
      siteConfig.siteOrigin,
    );

  return {
    name: 'docs-seo',
    config(config) {
      siteConfig = config;
      return config;
    },
    routeGenerated(generatedRoutes) {
      routes = generatedRoutes.filter((route) => route.routePath !== '/404');
    },
    extendPageData(page) {
      const current = routes.find((route) => route.routePath === page.routePath);
      const alternatives = current
        ? routes.filter(
            (route) =>
              route.version === current.version &&
              route.pureRoutePath === current.pureRoutePath &&
              route.lang,
          )
        : [];

      // Compiled MDX replaces frontmatter, so runtime metadata must stay at the top level.
      Object.assign(page, {
        seoAlternates:
          alternatives.length > 1
            ? alternatives.map((route): AlternateLink => ({
                rel: 'alternate',
                hreflang: route.lang.replace(/_/g, '-'),
                href: pageUrl(route.routePath),
              }))
            : [],
      });
    },
    async afterBuild(config, isProd) {
      if (!isProd) return;

      if (!config.siteOrigin) {
        throw new Error('A siteOrigin is required to generate the sitemap.');
      }

      const urls = [...new Set(routes.map((route) => pageUrl(route.routePath)))].sort();
      const entries = urls.map((url) => {
        const escaped = url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `  <url><loc>${escaped}</loc></url>`;
      });

      await writeFile(
        path.resolve(config.outDir ?? 'doc_build', 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`,
      );
    },
  };
}
