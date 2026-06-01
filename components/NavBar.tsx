'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, List, Search } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const navItems = [
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/events', label: 'Events', icon: List },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState('');

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/events?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <header
      className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-stone-200"
      style={{ boxShadow: 'var(--shadow-nav)' }}
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
        <Link href="/" className="flex-shrink-0">
          <span className="font-serif text-xl font-bold text-stone-900" style={{ fontFamily: 'var(--font-serif)' }}>
            Sydney Culture
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors border-b-2 ${
                  active
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-stone-600 hover:text-stone-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <form onSubmit={handleSearch} className="ml-auto flex-1 max-w-xs">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search events…"
              className="w-full pl-9 pr-4 py-1.5 text-sm bg-stone-100 border border-stone-200 rounded-full placeholder-stone-400 text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all"
            />
          </div>
        </form>
      </div>
    </header>
  );
}
