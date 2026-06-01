'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, List, MapPin } from 'lucide-react';

const navItems = [
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/events', label: 'Events', icon: List },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header className="bg-teal-700 text-white shadow-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <MapPin className="w-5 h-5 text-teal-200" />
          <span className="hidden sm:inline">Sydney Culture Calendar</span>
          <span className="sm:hidden">SCC</span>
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-teal-600 text-white'
                    : 'text-teal-100 hover:bg-teal-600 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
