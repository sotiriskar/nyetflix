'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Close from '@mui/icons-material/Close';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import Menu from '@mui/icons-material/Menu';
import EditOutlined from '@mui/icons-material/EditOutlined';
import PersonOutlined from '@mui/icons-material/PersonOutlined';
import Search from '@mui/icons-material/Search';
import HelpOutline from '@mui/icons-material/HelpOutline';
import NotificationsNone from '@mui/icons-material/NotificationsNone';
import SwapHoriz from '@mui/icons-material/SwapHoriz';
import { useProfile } from '@/context/ProfileContext';

const NAV_ITEMS = [
  { label: 'Home', to: '/browse' },
  { label: 'Series', to: '/series' },
  { label: 'Films', to: '/films' },
  { label: 'My List', to: '/browse/my-list' },
];

interface TopBarProps {
  /** Optional: open account/profile settings (used by standalone React App wrapper). */
  onOpenAccount?: () => void;
}

export function TopBar({ onOpenAccount }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentProfileId, setCurrentProfileId, profiles } = useProfile();
  const currentProfile = profiles.find((p) => p.id === currentProfileId);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // Sync search input with URL when on search page
  useEffect(() => {
    if (pathname === '/search') {
      const q = searchParams.get('q') ?? '';
      setSearchQuery(q);
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setScrolled(window.scrollY > 20);
  }, [pathname]);

  const clearProfileMenuCloseTimeout = () => {
    if (profileMenuCloseTimeoutRef.current) {
      clearTimeout(profileMenuCloseTimeoutRef.current);
      profileMenuCloseTimeoutRef.current = null;
    }
  };
  const scheduleProfileMenuClose = () => {
    clearProfileMenuCloseTimeout();
    profileMenuCloseTimeoutRef.current = setTimeout(() => setProfileMenuOpen(false), 150);
  };
  const handleProfileMenuEnter = () => {
    clearProfileMenuCloseTimeout();
    setProfileMenuOpen(true);
  };
  const handleProfileMenuLeave = () => scheduleProfileMenuClose();

  const isSettings = pathname.startsWith('/settings');
  const solidBlack = isSettings || scrolled;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isSettings ? 'border-b border-white/10' : ''}`}
      style={{
        ...(solidBlack
          ? { backgroundColor: 'rgba(0,0,0,0.95)' }
          : {
              background:
                'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 60%, rgba(0,0,0,0.04) 100%)',
            }),
      }}
    >
      {/* Single row: logo left, profile right (classic Netflix top bar) */}
      <div className="flex items-center justify-between px-6 md:px-12 h-16">
        <Link href="/" className="shrink-0 flex items-center">
          <img src="/static/logo.png" alt="NYETFLIX" className="h-7 md:h-8 w-auto object-contain" />
        </Link>

      {/* Hamburger - visible only on small screens, hide on settings */}
      {!isSettings && (
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
      )}

      {/* Nav - center, desktop only, hide on settings */}
      {!isSettings && (
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
      )}

      {/* Mobile menu dropdown */}
      {!isSettings && mobileMenuOpen && (
        <nav
          className="absolute top-16 left-0 right-0 md:hidden flex flex-col gap-1 py-3 px-6 bg-black/95 border-b border-white/10"
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

      {/* Right: search, notification, profile – consistent gap between each */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Search: icon or expanded input - hide on settings */}
        {!isSettings && (
        <div className="flex items-center shrink-0">
          {searchOpen ? (
            <div className="flex items-center gap-2 bg-black rounded border border-white/20 overflow-hidden transition-opacity duration-200">
              <span className="pl-3 text-white/70" aria-hidden>
                <Search sx={{ fontSize: 22, color: 'inherit' }} />
              </span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Titles, people, genres"
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
                className="flex-1 min-w-0 w-40 sm:w-48 md:w-56 bg-transparent py-2.5 pr-2 text-sm text-white placeholder-white/50 outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="p-2 text-white/70 hover:text-white shrink-0"
                aria-label="Close search"
              >
                <Close sx={{ fontSize: 20, color: 'inherit' }} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="p-2.5 text-white/90 hover:text-white transition-colors"
              aria-label="Open search"
            >
              <Search sx={{ fontSize: 24, color: 'inherit' }} />
            </button>
          )}
        </div>
        )}

        {/* Notifications bell – hover to show "No recent notifications" */}
        {!isSettings && (
          <div
            className="relative shrink-0"
            onMouseEnter={() => setNotificationsOpen(true)}
            onMouseLeave={() => setNotificationsOpen(false)}
          >
            <button
              type="button"
              className="p-2.5 text-white/90 hover:text-white transition-colors"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
            >
              <NotificationsNone sx={{ fontSize: 24, color: 'inherit' }} />
            </button>
            {notificationsOpen && (
              <div
                className="absolute right-0 top-full mt-2 z-50"
                role="tooltip"
              >
                <div className="bg-black border border-white/10 rounded shadow-xl min-w-[220px] py-4 px-4">
                  <p className="text-white/70 text-sm text-center">No recent notifications</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Profile: avatar + dropdown (open on hover, Netflix-style menu) */}
        <div
          className="relative shrink-0 flex items-center"
          ref={profileMenuRef}
          onMouseEnter={handleProfileMenuEnter}
          onMouseLeave={handleProfileMenuLeave}
        >
          <button
            type="button"
            className="flex items-center gap-1.5 p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Profile and settings"
            aria-expanded={profileMenuOpen}
            aria-haspopup="true"
          >
            <div className="w-8 h-8 md:w-9 md:h-9 shrink-0 rounded overflow-hidden bg-white/10">
              <img
                src={currentProfile?.avatarPath ?? '/static/avatar_1.png'}
                alt={currentProfile?.name ?? 'Profile'}
                className="w-full h-full object-cover"
              />
            </div>
            <ArrowDropDownIcon
              sx={{ fontSize: 18, color: 'white' }}
              className={`transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {profileMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1 min-w-[220px] py-1 rounded bg-black border border-white/10 shadow-xl z-50"
              role="menu"
            >
              {/* Profiles */}
              {profiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setCurrentProfileId(p.id as 1 | 2 | 3 | 4 | 5);
                    if (pathname.startsWith('/settings/profile/')) {
                      router.push(`/settings/profile/${p.id}`);
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-white/90 hover:text-white hover:underline transition-colors"
                >
                  <div className="w-8 h-8 rounded overflow-hidden bg-white/10 shrink-0">
                    <img src={p.avatarPath} alt="" className="w-full h-full object-cover" />
                  </div>
                  <span>{p.name}</span>
                </button>
              ))}
              {/* Manage Profiles, Transfer, Account, Help Centre */}
              <button
                type="button"
                role="menuitem"
                onClick={() => router.push('/settings/profiles')}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-white/90 hover:text-white hover:underline transition-colors"
              >
                <EditOutlined sx={{ fontSize: 20, color: 'inherit' }} />
                Manage Profiles
              </button>
              <button
                type="button"
                role="menuitem"
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-white/90 hover:text-white hover:underline transition-colors"
              >
                <SwapHoriz sx={{ fontSize: 20, color: 'inherit' }} />
                Transfer Profile
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  if (onOpenAccount) onOpenAccount();
                  else if (currentProfileId != null) router.push(`/settings/profile/${currentProfileId}`);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-white/90 hover:text-white hover:underline transition-colors"
              >
                <PersonOutlined sx={{ fontSize: 20, color: 'inherit' }} />
                Account
              </button>
              <button
                type="button"
                role="menuitem"
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-white/90 hover:text-white hover:underline transition-colors"
              >
                <HelpOutline sx={{ fontSize: 20, color: 'inherit' }} />
                Help Centre
              </button>
              <div className="border-t border-white/10 my-1" />
              <div className="px-4 py-2.5">
                <button
                  type="button"
                  role="menuitem"
                  className="w-full text-center text-sm text-white/90 hover:text-white hover:underline transition-colors"
                >
                  Sign out of Netflix
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </header>
  );
}
