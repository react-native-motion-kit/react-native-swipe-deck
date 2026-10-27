import type { RspressPlugin } from '@rspress/core';

import { normalizeHref, withBase, withSiteOrigin } from '@rspress/core';
import { writeFile } from 'node:fs/promises';
import * as path from 'node:path';

export function sitemapPlugin(): RspressPlugin {
  let routePaths: string[] = [];

  return {
    name: 'docs-sitemap',
    routeGenerated(routes) {
      routePaths = routes.map((route) => route.routePath);
    },
    async afterBuild(config, isProd) {
      if (!isProd) return;

      if (!config.siteOrigin) {
        throw new Error('A siteOrigin is required to generate the sitemap.');
      }

      const urls = [
        ...new Set(
          routePaths
            .filter((routePath) => routePath !== '/404')
            .map((routePath) =>
              withSiteOrigin(
                withBase(
                  normalizeHref(routePath, config.route?.cleanUrls ?? false),
                  config.base ?? '/',
                ),
                config.siteOrigin,
              ),
            ),
        ),
      ].sort();
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
