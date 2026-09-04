import type { MetadataRoute } from 'next';

/**
 * PWA manifest. Installing puts Photon on a home screen, which is where a
 * daily instrument belongs — but note that an installed PWA is still a browser,
 * so it does not unlock anything the tab could not already measure. The Method
 * page says so rather than letting the install imply otherwise.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Photon',
    short_name: 'Photon',
    description: 'See what your screens are really doing.',
    start_url: '/',
    display: 'standalone',
    background_color: '#EFF4F9',
    theme_color: '#EFF4F9',
    orientation: 'portrait',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
