import type { Metadata, Viewport } from 'next';
import './globals.css';
import NavBar from '@/components/NavBar';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: siteConfig.brand.siteName,
  description: siteConfig.brand.description,
};

export const viewport: Viewport = {
  themeColor: siteConfig.theme.colours.primary,
};

// City theme — overrides the --colour-* defaults declared in globals.css
const themeVars = {
  '--colour-ink': siteConfig.theme.colours.ink,
  '--colour-muted': siteConfig.theme.colours.muted,
  '--colour-line': siteConfig.theme.colours.line,
  '--colour-surface': siteConfig.theme.colours.surface,
  '--colour-surface-soft': siteConfig.theme.colours.surfaceSoft,
  '--colour-primary': siteConfig.theme.colours.primary,
  '--colour-primary-dark': siteConfig.theme.colours.primaryDark,
  '--colour-primary-soft': siteConfig.theme.colours.primarySoft,
  '--colour-accent': siteConfig.theme.colours.accent,
  '--colour-free': siteConfig.theme.colours.free,
  '--colour-ticketed': siteConfig.theme.colours.ticketed,
} as React.CSSProperties;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={siteConfig.city.lang} style={themeVars}>
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
          {siteConfig.brand.footerText}
        </footer>
      </body>
    </html>
  );
}
