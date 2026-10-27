import './index.css';
import type { ComponentProps } from 'react';

import {
  normalizeHrefInRuntime,
  useHead,
  usePage,
  withBase,
  withSiteOrigin,
} from '@rspress/core/runtime';
import {
  HomeLayout as BasicHomeLayout,
  Layout as BasicLayout,
  NotFoundLayout as BasicNotFoundLayout,
  PackageManagerTabs,
} from '@rspress/core/theme-original';
import { useEffect } from 'react';

const GUIDE_SECTION_NAMES = new Set(['getting-started', 'usage']);
const INSTALL_PACKAGES = '@react-native-motion-kit/swipe-deck';

function Layout(props: ComponentProps<typeof BasicLayout>) {
  const { page } = usePage();

  useHead({
    link:
      page.pageType === '404'
        ? []
        : [
            {
              rel: 'canonical',
              href: withSiteOrigin(withBase(normalizeHrefInRuntime(page.routePath))),
            },
          ],
  });

  return <BasicLayout {...props} />;
}

function getGuideRedirectPath(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  const prefix: string[] = [];
  let rest = parts;
  let hadDefaultVersionPrefix = false;

  if (rest[0] === '1.x') {
    hadDefaultVersionPrefix = true;
    rest = rest.slice(1);
  }

  if (rest[0] === 'ko') {
    prefix.push(rest[0]);
    rest = rest.slice(1);
  }

  const [section] = rest;

  if (hadDefaultVersionPrefix && section === 'guide') {
    return `/${[...prefix, ...rest].join('/')}`;
  }

  if (section && GUIDE_SECTION_NAMES.has(section)) {
    return `/${[...prefix, 'guide', ...rest].join('/')}`;
  }

  return null;
}

function HomeLayout() {
  return (
    <BasicHomeLayout
      afterHeroActions={
        <div className="rspress-doc home-install-command">
          <PackageManagerTabs command={INSTALL_PACKAGES} />
        </div>
      }
    />
  );
}

function NotFoundLayout() {
  useEffect(() => {
    const redirectPath = getGuideRedirectPath(window.location.pathname);

    if (redirectPath) {
      window.location.replace(`${redirectPath}${window.location.search}${window.location.hash}`);
    }
  }, []);

  return <BasicNotFoundLayout />;
}

export { HomeLayout, Layout, NotFoundLayout };
// oxlint-disable-next-line import/export
export * from '@rspress/core/theme-original';
