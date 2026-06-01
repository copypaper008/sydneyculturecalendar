'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  { href: '/events', label: 'Events' },
  { href: '/calendar', label: 'Calendar' },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState('');

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/events?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 10,
      display: 'grid',
      gridTemplateColumns: '1fr auto 280px',
      gap: 'var(--space-5)',
      alignItems: 'center',
      padding: `var(--space-3) max(24px, calc((100vw - var(--max-width)) / 2 + var(--space-4)))`,
      background: 'rgb(255 253 248 / 92%)',
      borderBottom: '1px solid var(--colour-line)',
      backdropFilter: 'blur(14px)',
    }}>
      <Link href="/" style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 700, color: 'var(--colour-ink)' }}>
        Sydney Culture
      </Link>

      <nav style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
        {navItems.map(({ href, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                paddingBlock: '.35rem',
                color: active ? 'var(--colour-primary-dark)' : 'var(--colour-muted)',
                fontSize: '.92rem',
                fontWeight: 650,
                borderBottom: active ? '2px solid var(--colour-primary)' : '2px solid transparent',
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <form onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cultural events…"
          style={{
            width: '100%',
            minHeight: '44px',
            padding: '0 var(--space-3)',
            color: 'var(--colour-ink)',
            background: 'white',
            border: '1px solid var(--colour-line)',
            borderRadius: '999px',
            fontSize: '.9rem',
            outline: 'none',
            fontFamily: 'var(--font-body)',
          }}
        />
      </form>
    </header>
  );
}
