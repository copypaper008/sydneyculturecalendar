import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.brand.siteName,
    short_name: siteConfig.manifest.shortName,
    description: siteConfig.brand.description,
    start_url: siteConfig.manifest.startUrl,
    display: 'standalone',
    background_color: siteConfig.manifest.backgroundColor,
    theme_color: siteConfig.theme.colours.primary,
    orientation: 'portrait',
    categories: siteConfig.manifest.categories,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
