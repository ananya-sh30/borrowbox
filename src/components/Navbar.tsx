import { useState, useRef, useEffect, type FormEvent } from 'react';
import {
  Search,
  ShoppingBag,
  User as UserIcon,
  LogOut,
  ChevronDown,
  Menu,
  X,
  PackageCheck,
  Store,
  ShoppingBag as BagIcon,
} from 'lucide-react';
import type { AppRoute, User } from '../types';

interface NavbarProps {
  currentRoute: AppRoute;
  onNavigate: (
    route: AppRoute,
    params?: { search?: string; category?: string; tab?: 'cart' | 'orders' },
  ) => void;
  user: User | null;
  cartCount: number;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onLogout: () => void;
}

export function Navbar({
  currentRoute,
  onNavigate,
  user,
  cartCount,
  searchQuery: externalSearch = '',
  onSearchChange,
  onLogout,
}: NavbarProps) {
  const [localSearch, setLocalSearch] = useState(externalSearch);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalSearch(externalSearch);
  }, [externalSearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchInput = (val: string) => {
    setLocalSearch(val);
    if (currentRoute === '/products' && onSearchChange) {
      onSearchChange(val);
    }
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    onNavigate('/products', { search: localSearch.trim() });
    setMobileMenuOpen(false);
  };

  const navLinkClass = (active: boolean) =>
    `text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 ${
      active
        ? 'text-[#5478D5] underline decoration-2 underline-offset-8'
        : 'text-[#646B7A] hover:text-[#252A34]'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-[#E5E8F0] bg-white/95 backdrop-blur-xs">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:gap-7">
        {/* Zone 1: Single-line Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="font-display text-xl font-bold tracking-tight text-[#252A34] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5478D5]"
        >
          Borrow<span className="text-[#5478D5]">Box</span>
        </button>

        {/* Proper Inline Search Bar (Desktop & Tablet) */}
        <form
          onSubmit={handleSearchSubmit}
          className="hidden min-w-[180px] flex-1 max-w-sm xl:max-w-md items-center md:flex"
          role="search"
          aria-label="Search rental catalog"
        >
          <div className="relative flex w-full items-center">
            <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-[#646B7A]" />
            <input
              type="search"
              value={localSearch}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search cameras, projectors, gear..."
              className="w-full rounded-full border border-[#E5E8F0] bg-[#F6F7FB] py-2 pr-20 pl-10 text-sm text-[#252A34] placeholder:text-[#646B7A] transition-colors focus:border-[#5478D5] focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              className="absolute right-1.5 rounded-full bg-[#5478D5] px-3.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-[#4365BE] whitespace-nowrap"
            >
              Search
            </button>
          </div>
        </form>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden items-center gap-5 xl:gap-6 lg:flex" aria-label="Main navigation">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className={navLinkClass(currentRoute === '/')}
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/products')}
            className={navLinkClass(currentRoute === '/products')}
          >
            Explore Rentals
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/orders', { tab: 'orders' })}
            className={navLinkClass(currentRoute === '/orders')}
          >
            My Orders
          </button>
        </nav>

        {/* Zone 3: Cart & Primary Account Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('/cart', { tab: 'cart' })}
            className="relative inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#E5E8F0] bg-white px-3.5 py-2 text-sm font-medium text-[#252A34] transition-colors hover:bg-[#F6F7FB] whitespace-nowrap shrink-0"
            aria-label={`Shopping Cart with ${cartCount} items`}
          >
            <ShoppingBag className="h-4 w-4 text-[#5478D5]" />
            <span className="hidden sm:inline">Cart</span>
            <span className="font-mono text-xs font-semibold tabular-nums text-[#5478D5]">
              ({cartCount})
            </span>
          </button>

          {user ? (
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                onClick={() => setAccountOpen((prev) => !prev)}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#E9EDFF] px-3.5 py-2 text-sm font-medium text-[#252A34] transition-colors hover:bg-[#DCE3FF] whitespace-nowrap shrink-0"
              >
                <UserIcon className="h-4 w-4 text-[#5478D5]" />
                <span className="max-w-[110px] truncate">{user.fullName.split(' ')[0]}</span>
                <ChevronDown className="h-3.5 w-3.5 text-[#646B7A]" />
              </button>

              {accountOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-[#E5E8F0] bg-white p-1.5 shadow-lg">
                  <div className="border-b border-[#E5E8F0] px-3 py-2.5">
                    <p className="truncate text-sm font-semibold text-[#252A34]">{user.fullName}</p>
                    <p className="truncate text-xs text-[#646B7A]">
                      {user.email.endsWith('@phone.borrowbox.local') ? user.phone : user.email}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-[#5478D5]">
                      {user.role === 'admin'
                        ? 'Administrator'
                        : user.role === 'provider'
                          ? `Provider: ${user.providerProfile?.businessName || 'Verified Partner'}`
                          : user.providerStatus === 'pending'
                            ? 'Customer · Provider Application Pending'
                            : 'Customer Account'}
                    </p>
                  </div>
                  {user.role === 'admin' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAccountOpen(false);
                        onNavigate('/admin');
                      }}
                      className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-[#252A34] hover:bg-[#F6F7FB]"
                    >
                      <PackageCheck className="h-4 w-4 text-[#5478D5]" />
                      <span>Admin Dashboard</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setAccountOpen(false);
                          onNavigate('/orders', { tab: 'orders' });
                        }}
                        className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-[#252A34] hover:bg-[#F6F7FB]"
                      >
                        <PackageCheck className="h-4 w-4 text-[#5478D5]" />
                        <span>My Orders</span>
                      </button>

                      {user.role === 'provider' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setAccountOpen(false);
                              onNavigate('/provider');
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#5478D5] hover:bg-[#E9EDFF]/50"
                          >
                            <Store className="h-4 w-4 text-[#5478D5]" />
                            <span>Provider Dashboard</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAccountOpen(false);
                              onNavigate('/products');
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-[#252A34] hover:bg-[#F6F7FB]"
                          >
                            <BagIcon className="h-4 w-4 text-[#5478D5]" />
                            <span>Rent Products (Customer Mode)</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setAccountOpen(false);
                            onNavigate('/become-provider');
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#5478D5] hover:bg-[#E9EDFF]/50"
                        >
                          <Store className="h-4 w-4 text-[#5478D5]" />
                          <span>
                            {user.providerStatus === 'pending'
                              ? 'Provider Application Status'
                              : 'Become a Provider'}
                          </span>
                        </button>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen(false);
                      onLogout();
                    }}
                    className="mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-[#DC2626] hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="hidden min-h-[40px] items-center rounded-lg bg-[#5478D5] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4365BE] whitespace-nowrap shrink-0 sm:inline-flex"
            >
              Login / Sign Up
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-[#E5E8F0] text-[#252A34] lg:hidden"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Compact search bar on small screens (<768px) */}
      <div className="border-t border-[#E5E8F0] bg-white px-4 py-2.5 md:hidden">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2" role="search">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#646B7A]" />
            <input
              type="search"
              value={localSearch}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search cameras, projectors, gear..."
              className="w-full rounded-full border border-[#E5E8F0] bg-[#F6F7FB] py-2 pr-3 pl-9 text-sm text-[#252A34] placeholder:text-[#646B7A] focus:border-[#5478D5] focus:bg-white focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-full bg-[#5478D5] px-4 py-2 text-xs font-semibold text-white"
          >
            Go
          </button>
        </form>
      </div>

      {/* Mobile & Tablet navigation drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-[#E5E8F0] bg-white px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onNavigate('/');
              }}
              className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#252A34] hover:bg-[#F6F7FB]"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onNavigate('/products');
              }}
              className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#252A34] hover:bg-[#F6F7FB]"
            >
              Explore Rentals
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onNavigate('/orders', { tab: 'orders' });
              }}
              className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#252A34] hover:bg-[#F6F7FB]"
            >
              My Orders
            </button>
            {user && user.role !== 'admin' && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigate(user.role === 'provider' ? '/provider' : '/become-provider');
                }}
                className="rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#5478D5] hover:bg-[#E9EDFF]/50"
              >
                {user.role === 'provider' ? 'Provider Dashboard' : 'Become a Provider'}
              </button>
            )}
            {!user && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigate('/login');
                }}
                className="mt-2 rounded-lg bg-[#5478D5] px-4 py-2.5 text-center text-sm font-medium text-white"
              >
                Login / Sign Up
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
