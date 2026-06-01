import type { Metadata, Viewport } from 'next';
import './globals.css';
import NavBar from '@/components/NavBar';

export const metadata: Metadata = {
  title: 'Sydney Culture Calendar',
  description: 'Discover exhibitions, festivals, talks and performances across Sydney',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#2a9d8f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col antialiased" style={{ background: 'var(--color-cream)' }}>
        <NavBar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-stone-200 text-stone-500 text-xs text-center py-5 mt-12"
          style={{ background: 'var(--color-cream-dark)' }}>
          Sydney Culture Calendar — aggregating cultural events across the city
        </footer>
      </body>
    </html>
  );
}
