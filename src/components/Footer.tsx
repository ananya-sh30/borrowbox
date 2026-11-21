import { Mail, Phone, MapPin, ShieldCheck } from 'lucide-react';
import type { AppRoute } from '../types';

interface FooterProps {
  onNavigate: (route: AppRoute, params?: { category?: string; tab?: 'cart' | 'orders' }) => void;
  onOpenLegal: (type: 'terms' | 'privacy') => void;
}

export function Footer({ onNavigate, onOpenLegal }: FooterProps) {
  return (
    <footer className="border-t border-[#E5E8F0] bg-[#F6F7FB] text-[#252A34]">
      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-12">
          {/* Brand Column */}
          <div className="md:col-span-4">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="font-display text-xl font-bold tracking-tight text-[#252A34]"
            >
              Borrow<span className="text-[#5478D5]">Box</span>
            </button>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#646B7A]">
              Don&apos;t Buy It. Borrow It. BorrowBox helps students, creators, and teams access
              quality cameras, electronics, calculators, and event equipment on flexible daily rentals.
            </p>
            <div className="mt-5 flex items-center gap-4 text-xs font-medium text-[#646B7A]">
              <a
                href="#instagram"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/products');
                }}
                className="hover:text-[#5478D5] transition-colors"
              >
                Instagram
              </a>
              <span aria-hidden="true">·</span>
              <a
                href="#linkedin"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/products');
                }}
                className="hover:text-[#5478D5] transition-colors"
              >
                LinkedIn
              </a>
              <span aria-hidden="true">·</span>
              <a
                href="#youtube"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/products');
                }}
                className="hover:text-[#5478D5] transition-colors"
              >
                YouTube
              </a>
            </div>
          </div>

          {/* Marketplace Links */}
          <div className="md:col-span-3">
            <h3 className="text-sm font-semibold text-[#252A34]">Marketplace</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-[#646B7A]">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/products')}
                  className="hover:text-[#5478D5] transition-colors"
                >
                  Explore All Rentals
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/products', { category: 'Photography' })}
                  className="hover:text-[#5478D5] transition-colors"
                >
                  Photography &amp; Cameras
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/products', { category: 'Electronics' })}
                  className="hover:text-[#5478D5] transition-colors"
                >
                  Projectors &amp; Audio
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/orders', { tab: 'orders' })}
                  className="hover:text-[#5478D5] transition-colors"
                >
                  Track My Rentals
                </button>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="md:col-span-3">
            <h3 className="text-sm font-semibold text-[#252A34]">Contact</h3>
            <ul className="mt-4 space-y-3 text-sm text-[#646B7A]">
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-[#5478D5]" />
                <span>support@borrowbox.example.com</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-[#5478D5]" />
                <span>+91 98765 43210</span>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#5478D5]" />
                <span>Campus Hub, Innovation Block B, Bengaluru 560001</span>
              </li>
            </ul>
          </div>

          {/* Legal & Admin Portal */}
          <div className="md:col-span-2">
            <h3 className="text-sm font-semibold text-[#252A34]">Policies &amp; Access</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-[#646B7A]">
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegal('terms')}
                  className="hover:text-[#5478D5] transition-colors"
                >
                  Terms &amp; Conditions
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegal('privacy')}
                  className="hover:text-[#5478D5] transition-colors"
                >
                  Privacy Policy
                </button>
              </li>
              <li className="pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('/admin-login')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5478D5] hover:underline"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Admin Portal</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-[#E5E8F0] pt-6 text-xs text-[#646B7A] sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} BorrowBox Rental Marketplace. All rights reserved.</p>
          <p>Academic E-Commerce Rental Demonstration Platform</p>
        </div>
      </div>
    </footer>
  );
}
