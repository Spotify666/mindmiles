import type { MetadataRoute } from 'next';

/**
 * PWA manifest. Installing puts Mind Miles on a home screen, which is where a
 * daily instrument belongs — but note that an installed PWA is still a browser,
 * so it does not unlock anything the tab could not already measure. The Method
 * page says so rather than letting the install imply otherwise.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mind Miles',
    short_name: 'Mind Miles',
    description: 'Measure where your attention goes.',
    start_url: '/',
    display: 'standalone',
    background_color: '#08090C',
    theme_color: '#08090C',
    orientation: 'portrait',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
