import type { Metadata, Viewport } from 'next';
import './globals.css';
import NavBar from '@/components/NavBar';

export const metadata: Metadata = {
  title: 'Sydney Culture Calendar',
  description: 'Discover exhibitions, festivals, talks and performances across Sydney',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#00796b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50 antialiased">
        <NavBar />
        <main className="flex-1">{children}</main>
        <footer className="bg-teal-800 text-teal-100 text-xs text-center py-4 mt-8">
          Sydney Culture Calendar — aggregating cultural events across the city
        </footer>
      </body>
    </html>
  );
}
