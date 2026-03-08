'use client';

import Link from 'next/link';
import { LayoutDashboard, Plus } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { strings } from '@/lib/i18n';

function TeaCupLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="-1 2 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M7 8C5.5 7 8.5 6 7 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M10 8C8.5 7 11.5 6 10 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M13 8C11.5 7 14.5 6 13 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="4.5" y="11" width="11" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M15.5 13.5Q20 13.5 20 15.5Q20 17.5 15.5 17.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { lang, toggle } = useLanguage();
  const t = strings[lang];

  const links = [
    { href: '/dashboard', label: t.nav_dashboard, icon: LayoutDashboard },
    { href: '/new', label: t.nav_newScan, icon: Plus },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-white transition-colors group-hover:bg-gray-700">
            <TeaCupLogo className="h-5 w-5" />
          </div>
          <span className="text-base font-bold tracking-tight text-gray-900">
            Almond te<span className="text-gray-400">AI</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === href
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}

          <button
            onClick={toggle}
            className="ml-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-900"
          >
            {lang === 'en' ? '中文' : 'EN'}
          </button>

          {status === 'authenticated' ? (
            <>
              <span className="ml-2 hidden text-sm text-gray-400 sm:inline">
                {session.user.name ?? session.user.email}
              </span>
              <button
                onClick={() => signOut()}
                className="ml-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-900"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={() => signIn('github')}
              className="ml-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
