# Documentation site

Run `pnpm -C docs dev` from the repository root for development, `pnpm docs:build`
for a production build, and `pnpm -C docs preview` to preview the built site.

## SEO

`rspress.config.ts` defines the production origin and enables clean URLs to match
Cloudflare Pages. `plugins/seo.ts` generates `sitemap.xml` from document routes
and supplies language alternatives for matching pages within the same version.
`theme/index.tsx` uses Rspress's `useHead` to update canonical and hreflang links
during client-side navigation as well as static rendering.

English and Korean homepage descriptions are defined in their frontmatter.
`docs/public/robots.txt` advertises the sitemap; the 404 page and public HTML
verification file are excluded from it.

This uses the public [Rspress plugin hooks](https://rspress.rs/plugin/system/plugin-api)
and [useHead API](https://rspress.rs/ui/hooks/use-head) supported by the installed
Rspress 2.0.23, without additional dependencies.
