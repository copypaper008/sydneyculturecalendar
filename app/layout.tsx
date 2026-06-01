import type { Metadata, Viewport } from 'next';
import './globals.css';
import NavBar from '@/components/NavBar';

export const metadata: Metadata = {
  title: 'Sydney Culture Calendar',
  description: 'Discover exhibitions, festivals, talks and performances across Sydney',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#0f766e',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ background: 'var(--colour-surface-soft)' }}>
        <NavBar />
        <main style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: 'var(--space-4)' }}>
          {children}
        </main>
        <footer style={{
          marginTop: 'var(--space-7)',
          padding: 'var(--space-5)',
          borderTop: '1px solid var(--colour-line)',
          textAlign: 'center',
          fontSize: '.8rem',
          color: 'var(--colour-muted)',
          background: 'var(--colour-surface)',
        }}>
          Sydney Culture Calendar — aggregating cultural events across the city
        </footer>
      </body>
    </html>
  );
}
