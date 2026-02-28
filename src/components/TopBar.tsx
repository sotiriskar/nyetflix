'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Close from '@mui/icons-material/Close';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Menu from '@mui/icons-material/Menu';
import PersonOutlined from '@mui/icons-material/PersonOutlined';
import Search from '@mui/icons-material/Search';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';

const NAV_ITEMS = [
  { label: 'Home', to: '/' },
  { label: 'Series', to: '/series' },
  { label: 'Films', to: '/films' },
  { label: 'My List', to: '/mylist' },
];

const PROFILE_MENU_ITEMS = [
  { label: 'Account', icon: PersonOutlined },
  { label: 'App Settings', icon: SettingsOutlined },
];

export interface TopBarProps {
  onOpenAccount?: () => void;
  onOpenAppSettings?: () => void;
}

export function TopBar({ onOpenAccount, onOpenAppSettings }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // Sync search input with URL when on search page
  useEffect(() => {
    if (pathname === '/search' && searchParams) {
      const q = searchParams.get('q') ?? '';
      setSearchQuery(q);
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('click', onClickOutside);
    return () => document.removeEventListener('click', onClickOutside);
  }, [profileMenuOpen]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 h-20 transition-all duration-300 ${
        scrolled ? 'bg-linear-to-b from-black/80 to-transparent' : 'bg-transparent'
      }`}
    >
      {/* Logo - left */}
      <Link href="/" className="shrink-0 flex items-center">
        <img src="/static/logo.png" alt="NYETFLIX" className="h-11 w-auto object-contain" />
      </Link>

      {/* Hamburger - visible only on small screens */}
      <button
        type="button"
        onClick={() => setMobileMenuOpen((o) => !o)}
        className="md:hidden p-2 -ml-2 text-white/90 hover:text-white transition-colors [&_svg]:w-7 [&_svg]:h-7"
        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileMenuOpen}
      >
        {mobileMenuOpen ? (
          <Close sx={{ fontSize: 28, color: 'inherit' }} />
        ) : (
          <Menu sx={{ fontSize: 28, color: 'inherit' }} />
        )}
      </button>

      {/* Nav - center, desktop only */}
      <nav className="hidden md:flex items-center gap-6 ml-10">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.label}
            href={item.to}
            className={`text-base transition-colors ${pathname === item.to ? 'text-white font-medium' : 'text-white/90 hover:text-white'}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <nav
          className="absolute top-20 left-0 right-0 md:hidden flex flex-col gap-1 py-3 px-6 bg-black/95 border-b border-white/10"
          aria-label="Mobile navigation"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.to}
              onClick={() => setMobileMenuOpen(false)}
              className={`text-base py-2 transition-colors ${pathname === item.to ? 'text-white font-medium' : 'text-white/90 hover:text-white'}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}

      {/* Right: search (expandable) + square icon */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Search: icon or expanded input */}
        <div className="flex items-center">
          {searchOpen ? (
            <div className="flex items-center bg-white/10 rounded-md overflow-hidden border border-white/20 transition-opacity duration-200">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search movies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => {
                  if (!searchQuery.trim()) setSearchOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchOpen(false);
                    setSearchQuery('');
                  }
                  if (e.key === 'Enter') {
                    const q = searchQuery.trim();
                    if (q) {
                      setSearchOpen(false);
                      router.push(`/search?q=${encodeURIComponent(q)}`);
                    }
                  }
                }}
                className="w-40 sm:w-56 md:w-64 bg-transparent px-3 py-2 text-sm text-white placeholder-white/50 outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="p-2 text-white/70 hover:text-white"
                aria-label="Close search"
              >
                <Close sx={{ fontSize: 20, color: 'inherit' }} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="p-2 text-white/90 hover:text-white transition-colors"
              aria-label="Open search"
            >
              <Search sx={{ fontSize: 26, color: 'inherit' }} />
            </button>
          )}
        </div>

        {/* Profile: avatar + dropdown chevron, opens settings */}
        <div className="relative shrink-0" ref={profileMenuRef}>
          <button
            type="button"
            onClick={() => setProfileMenuOpen((o) => !o)}
            className="flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Profile and settings"
            aria-expanded={profileMenuOpen}
            aria-haspopup="true"
          >
            <div className="w-10 h-10 shrink-0 rounded overflow-hidden">
              <img src="/static/avatar.png" alt="Profile" className="w-full h-full object-cover" />
            </div>
            <ExpandMore
              sx={{ fontSize: 20, color: 'white' }}
              className={`transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {profileMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1 min-w-[180px] py-1 rounded bg-[#181818] border border-white/10 shadow-xl z-50"
              role="menu"
            >
              {PROFILE_MENU_ITEMS.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    if (label === 'Account') onOpenAccount?.();
                    if (label === 'App Settings') onOpenAppSettings?.();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-white/90 hover:bg-white/10 transition-colors"
                >
                  <Icon sx={{ fontSize: 20, color: 'inherit' }} />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
