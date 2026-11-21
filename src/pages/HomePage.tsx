import { useState, useMemo, useEffect } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  ShieldCheck,
  Clock,
  Sparkles,
  Users,
  Wallet,
  Leaf,
  Tag,
  Check,
  Pause,
  Play,
  Layers,
  MapPin,
} from 'lucide-react';
import type { AppRoute, Bundle, Category, Product, User } from '../types';
import { formatInr } from '../lib/api';
import { HeroObjectSvg, type HeroSvgType } from '../components/CategorySvgs';

interface HomePageProps {
  user: User | null;
  categories: Category[];
  featuredProducts: Product[];
  bundles: Bundle[];
  onNavigate: (
    route: AppRoute,
    params?: { search?: string; category?: string },
  ) => void;
  onSelectProduct: (product: Product) => void;
  onSelectBundle: (bundle: Bundle) => void;
}

interface HeroObjectItem {
  label: string;
  rateHint: string;
  svgType: HeroSvgType;
  category?: string;
  search?: string;
}

const HERO_OBJECTS: HeroObjectItem[] = [
  {
    label: 'Cameras',
    rateHint: 'from ₹450/day',
    svgType: 'cameras',
    category: 'Photography',
  },
  {
    label: 'Tripods',
    rateHint: 'from ₹120/day',
    svgType: 'tripods',
    search: 'Tripod',
  },
  {
    label: 'Projectors',
    rateHint: 'from ₹300/day',
    svgType: 'projectors',
    category: 'Electronics',
  },
  {
    label: 'Calculators',
    rateHint: 'from ₹40/day',
    svgType: 'calculators',
    category: 'Education',
  },
  {
    label: 'Microphones',
    rateHint: 'from ₹180/day',
    svgType: 'microphones',
    search: 'Microphone',
  },
  {
    label: 'Studio Lights',
    rateHint: 'from ₹220/day',
    svgType: 'lights',
    search: 'Lighting',
  },
  {
    label: 'Sports Gear',
    rateHint: 'from ₹90/day',
    svgType: 'sports',
    category: 'Sports & Fitness',
  },
  {
    label: 'Camping',
    rateHint: 'from ₹250/day',
    svgType: 'camping',
    category: 'Travel & Outdoors',
  },
];

const LIFESTYLE_PHOTOS = {
  verifiedCondition: '/src/assets/images/verified_condition_inspection_1795288374564.jpg',
  livingRoom:
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ea/Living_room_%28Unsplash%29.jpg/960px-Living_room_%28Unsplash%29.jpg',
  howItWorksKit: '/src/assets/images/how_it_works_rental_kit_1795287792778.jpg',
};

type DealSlide =
  | {
      id: string;
      kind: 'bundle';
      badge: string;
      discountPct: number;
      title: string;
      subtitle: string;
      highlights: string[];
      locationLabel: string;
      image: string;
      dealPrice: number;
      originalPrice: number;
      savingsText: string;
      bundle: Bundle;
    }
  | {
      id: string;
      kind: 'product';
      badge: string;
      discountPct: number;
      title: string;
      subtitle: string;
      highlights: string[];
      locationLabel: string;
      image: string;
      dealPrice: number;
      originalPrice: number;
      savingsText: string;
      product: Product;
    };

export function HomePage({
  user,
  categories,
  featuredProducts,
  bundles,
  onNavigate,
  onSelectProduct,
  onSelectBundle,
}: HomePageProps) {
  const [dealSlideIndex, setDealSlideIndex] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);

  const deals = useMemo<DealSlide[]>(() => {
    const bundleDeals: DealSlide[] = bundles.map((b) => {
      const pct =
        b.individualTotalPerDay > 0
          ? Math.max(10, Math.round((b.savingsPerDay / b.individualTotalPerDay) * 100))
          : 20;
      return {
        id: `deal-${b.id}`,
        kind: 'bundle',
        badge: `${pct}% Off Smart Bundle`,
        discountPct: pct,
        title: b.name,
        subtitle: b.description || `Complete ${b.products.length}-item ready-to-rent kit`,
        highlights: b.products.map((p) => p.name),
        locationLabel: `${b.products.length}-Item Bundle · ${b.availableUnits} kits ready`,
        image: b.image,
        dealPrice: b.bundlePricePerDay,
        originalPrice: b.individualTotalPerDay,
        savingsText: `Save ${formatInr(b.savingsPerDay)}/day`,
        bundle: b,
      };
    });

    const productDeals: DealSlide[] = featuredProducts.slice(0, 5).map((p, idx) => {
      const pct = idx % 2 === 0 ? 15 : 20;
      const discountedRate = Math.round(p.pricePerDay * ((100 - pct) / 100));
      const savingsPerDay = Math.max(10, p.pricePerDay - discountedRate);
      return {
        id: `deal-${p.id}`,
        kind: 'product',
        badge: idx % 2 === 0 ? `${pct}% Off Multi-Day` : `${pct}% Off Student Deal`,
        discountPct: pct,
        title: p.name,
        subtitle: p.description,
        highlights: [
          `Pre-rental condition: ${p.condition}`,
          `${p.totalUnits} verified units available`,
          `Category: ${p.categoryName}`,
        ],
        locationLabel: `${p.providerName || 'BorrowBox Verified Hub'} · ${p.providerCity || 'Bengaluru'}`,
        image: p.image,
        dealPrice: discountedRate,
        originalPrice: p.pricePerDay,
        savingsText: `Save ${formatInr(savingsPerDay)}/day on 3+ days`,
        product: p,
      };
    });

    return [...bundleDeals, ...productDeals];
  }, [bundles, featuredProducts]);

  const totalSlides = deals.length;
  const activeSlide = totalSlides > 0 ? dealSlideIndex % totalSlides : 0;

  // Auto-advance the moving single-deal carousel smoothly
  useEffect(() => {
    if (carouselPaused || totalSlides <= 1) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      setDealSlideIndex((prev) => (prev + 1) % totalSlides);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [carouselPaused, totalSlides]);

  const handlePrevDeals = () => {
    if (totalSlides === 0) return;
    setDealSlideIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const handleNextDeals = () => {
    if (totalSlides === 0) return;
    setDealSlideIndex((prev) => (prev + 1) % totalSlides);
  };

  const providerRoute: AppRoute = user?.role === 'provider' ? '/provider' : '/become-provider';

  return (
    <div className="bg-white text-[#252A34]">
      {/* 1. Clean Creative Storefront Hero (Zero big hero image, crisp visual gear cards + offer strip) */}
      <section className="border-b border-[#E5E8F0] bg-gradient-to-b from-[#F6F7FB]/80 via-white to-white">
        <div className="mx-auto max-w-[1160px] px-4 pt-11 pb-14 sm:px-6 lg:pt-14 lg:pb-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold tracking-wide text-[#5478D5]">
              Don&apos;t Buy It. Borrow It.
            </p>
            <h1 className="font-display mt-2.5 text-[clamp(2.15rem,4.3vw,3.35rem)] leading-[1.1] font-bold tracking-tight text-[#252A34] [text-wrap:balance]">
              Borrow<span className="text-[#5478D5]">Box</span> - Rent Smart. Own Less.
            </h1>
            <p className="mx-auto mt-3.5 max-w-xl text-[15px] leading-relaxed text-[#646B7A]">
              Rent verified cameras, projectors, calculators &amp; outdoor gear by the day — or earn
              from equipment you own.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('/products')}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#252A34] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#5478D5] whitespace-nowrap shrink-0"
              >
                <span>Explore Rentals</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate(providerRoute)}
                className="inline-flex min-h-[44px] items-center rounded-full border border-[#E5E8F0] bg-white px-6 py-2.5 text-sm font-semibold text-[#252A34] transition-colors hover:border-[#5478D5] hover:text-[#5478D5] whitespace-nowrap shrink-0"
              >
                {user?.role === 'provider' ? 'Provider Console' : 'Become a Provider'}
              </button>
            </div>
          </div>

          {/* Creative 8-Card Cute Vector Showcase with Transparent Daily Starting Rates */}
          <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-3.5 sm:grid-cols-4 sm:gap-4">
            {HERO_OBJECTS.map((obj) => (
              <button
                key={obj.label}
                type="button"
                onClick={() =>
                  onNavigate('/products', {
                    category: obj.category || 'all',
                    search: obj.search || '',
                  })
                }
                className="group flex flex-col items-center rounded-2xl border border-[#E5E8F0] bg-white px-3 py-4 text-center transition-all duration-200 hover:-translate-y-1 hover:border-[#5478D5]/60 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5478D5]"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F6F7FB] transition-colors group-hover:bg-[#E9EDFF]/55">
                  <HeroObjectSvg
                    type={obj.svgType}
                    className="h-10 w-10 transition-transform duration-200 group-hover:scale-110"
                  />
                </div>
                <span className="mt-2.5 text-xs font-semibold text-[#252A34] group-hover:text-[#5478D5]">
                  {obj.label}
                </span>
                <span className="mt-0.5 font-mono text-[11px] font-medium tabular-nums text-[#646B7A]">
                  {obj.rateHint}
                </span>
              </button>
            ))}
          </div>

          {/* Crisp 3-Tile Offer & Marketplace Strip (Minimal copy, instant clarity) */}
          <div className="mx-auto mt-6 grid max-w-4xl gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => onNavigate('/products', { category: 'bundles' })}
              className="group flex items-center justify-between gap-3 rounded-xl border border-[#E5E8F0] bg-[#F6F7FB]/70 px-4 py-3 text-left transition-colors hover:border-[#5478D5]/50 hover:bg-white"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Layers className="h-4 w-4 shrink-0 text-[#5478D5]" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-[#252A34]">
                    Save up to 25% on Bundles
                  </p>
                  <p className="truncate text-[11px] text-[#646B7A]">
                    Photography, Camping &amp; Event Kits
                  </p>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#646B7A] transition-transform group-hover:translate-x-0.5 group-hover:text-[#5478D5]" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/products')}
              className="group flex items-center justify-between gap-3 rounded-xl border border-[#E5E8F0] bg-[#F6F7FB]/70 px-4 py-3 text-left transition-colors hover:border-[#5478D5]/50 hover:bg-white"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Tag className="h-4 w-4 shrink-0 text-[#299B68]" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-[#252A34]">
                    15% Off Multi-Day Rentals
                  </p>
                  <p className="truncate text-[11px] text-[#646B7A]">
                    Pick exact pickup &amp; return dates
                  </p>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#646B7A] transition-transform group-hover:translate-x-0.5 group-hover:text-[#5478D5]" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate(providerRoute)}
              className="group flex items-center justify-between gap-3 rounded-xl border border-[#E5E8F0] bg-[#F6F7FB]/70 px-4 py-3 text-left transition-colors hover:border-[#5478D5]/50 hover:bg-white"
            >
              <div className="flex items-center gap-3 min-w-0">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[#5478D5]" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-[#252A34]">
                    List Gear &amp; Earn Daily
                  </p>
                  <p className="truncate text-[11px] text-[#646B7A]">
                    Verified multi-vendor marketplace
                  </p>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#646B7A] transition-transform group-hover:translate-x-0.5 group-hover:text-[#5478D5]" />
            </button>
          </div>
        </div>
      </section>

      {/* 2. Second Scroll: Moving Single-Deal E-Commerce Carousel */}
      {deals.length > 0 && (
        <section
          aria-label="Latest Deals and Discounts Carousel"
          className="border-b border-[#E5E8F0] bg-[#F6F7FB] py-14"
        >
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5478D5]">
                  <Tag className="h-3.5 w-3.5" />
                  <span>Latest Deals &amp; Discounts</span>
                </p>
                <h2 className="font-display mt-1 text-2xl font-bold tracking-tight text-[#252A34] sm:text-3xl">
                  Spotlight Bundle Offers &amp; Multi-Day Savings
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCarouselPaused((prev) => !prev)}
                  aria-label={carouselPaused ? 'Resume deals carousel' : 'Pause deals carousel'}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[#E5E8F0] bg-white px-3.5 text-xs font-medium text-[#252A34] transition-colors hover:border-[#5478D5] hover:text-[#5478D5]"
                >
                  {carouselPaused ? (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      <span>Play</span>
                    </>
                  ) : (
                    <>
                      <Pause className="h-3.5 w-3.5" />
                      <span>Auto</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handlePrevDeals}
                  aria-label="Previous deal"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E8F0] bg-white text-[#252A34] transition-colors hover:border-[#5478D5] hover:text-[#5478D5]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextDeals}
                  aria-label="Next deal"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E8F0] bg-white text-[#252A34] transition-colors hover:border-[#5478D5] hover:text-[#5478D5]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Smooth Moving Track (1 Featured Deal Per Slide Section) */}
            <div
              onMouseEnter={() => setCarouselPaused(true)}
              onMouseLeave={() => setCarouselPaused(false)}
              className="mt-7 overflow-hidden rounded-2xl border border-[#E5E8F0] bg-white shadow-xs"
            >
              <div
                className="flex transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ transform: `translateX(-${activeSlide * 100}%)` }}
              >
                {deals.map((deal, idx) => (
                  <div
                    key={deal.id}
                    className="grid w-full shrink-0 grid-cols-1 md:grid-cols-12"
                  >
                    {/* Left Photo Showcase */}
                    <div className="relative min-h-[260px] bg-[#F6F7FB] sm:min-h-[340px] md:col-span-7">
                      <img
                        src={deal.image}
                        alt={deal.title}
                        referrerPolicy="no-referrer"
                        className="h-full max-h-[380px] w-full object-cover"
                      />
                      <div className="absolute top-4 left-4 rounded-lg bg-[#252A34]/90 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-xs">
                        {deal.badge}
                      </div>
                      <div className="absolute right-4 bottom-4 rounded-lg bg-white/95 px-2.5 py-1 font-mono text-[11px] font-semibold text-[#252A34] backdrop-blur-xs">
                        Deal {idx + 1} / {deals.length}
                      </div>
                    </div>

                    {/* Right Offer Details */}
                    <div className="flex flex-col justify-between p-6 sm:p-8 md:col-span-5">
                      <div>
                        <p className="flex items-center gap-1.5 text-xs font-medium text-[#5478D5]">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span>{deal.locationLabel}</span>
                        </p>
                        <h3 className="font-display mt-2 text-2xl font-bold tracking-tight text-[#252A34]">
                          {deal.title}
                        </h3>
                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#646B7A]">
                          {deal.subtitle}
                        </p>

                        <ul className="mt-4 space-y-1.5">
                          {deal.highlights.slice(0, 3).map((item) => (
                            <li
                              key={item}
                              className="flex items-center gap-2 text-xs text-[#252A34]"
                            >
                              <Check className="h-3.5 w-3.5 shrink-0 text-[#299B68]" />
                              <span className="truncate">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-6 border-t border-[#E5E8F0] pt-5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="flex items-baseline gap-2.5">
                            <span className="font-mono text-2xl font-bold tabular-nums text-[#252A34]">
                              {formatInr(deal.dealPrice)}
                              <span className="font-sans text-xs font-normal text-[#646B7A]">
                                {' '}
                                / day
                              </span>
                            </span>
                            {deal.originalPrice > deal.dealPrice && (
                              <span className="font-mono text-sm tabular-nums text-[#646B7A] line-through">
                                {formatInr(deal.originalPrice)}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-semibold text-[#299B68]">
                            {deal.savingsText}
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              deal.kind === 'bundle'
                                ? onSelectBundle(deal.bundle)
                                : onSelectProduct(deal.product)
                            }
                            className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#5478D5] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#4365BE] whitespace-nowrap"
                          >
                            <span>
                              {deal.kind === 'bundle' ? 'Rent Bundle Deal' : 'Book This Deal'}
                            </span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onNavigate('/products')}
                            className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-[#E5E8F0] bg-white px-4 py-2.5 text-xs font-semibold text-[#252A34] transition-colors hover:border-[#5478D5] hover:text-[#5478D5] whitespace-nowrap"
                          >
                            All Rentals
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Slide Thumbnail Switcher + Indicators */}
            <div className="mt-4 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {deals.map((deal, idx) => {
                const isActive = idx === activeSlide;
                return (
                  <button
                    key={deal.id}
                    type="button"
                    onClick={() => setDealSlideIndex(idx)}
                    className={`flex min-w-[205px] shrink-0 items-center gap-3 rounded-xl border p-2 text-left transition-all ${
                      isActive
                        ? 'border-[#5478D5] bg-white shadow-2xs'
                        : 'border-[#E5E8F0] bg-white/70 hover:bg-white'
                    }`}
                  >
                    <img
                      src={deal.image}
                      alt={deal.title}
                      referrerPolicy="no-referrer"
                      className="h-11 w-14 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-xs font-semibold ${
                          isActive ? 'text-[#5478D5]' : 'text-[#252A34]'
                        }`}
                      >
                        {deal.title}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] font-medium tabular-nums text-[#646B7A]">
                        {formatInr(deal.dealPrice)}/day · {deal.discountPct}% off
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 3. Amazing Benefits Bento Grid (Inspired by Reference Aesthetic) */}
      <section className="mx-auto max-w-[1160px] px-4 py-16 sm:px-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <h2 className="font-display text-3xl leading-tight font-bold tracking-tight text-[#252A34]">
            Amazing benefits
          </h2>
          <p className="max-w-xs text-sm text-[#646B7A]">
            From saving money on occasional gear to earning from what you own.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Light */}
          <div className="flex min-h-[190px] flex-col justify-between rounded-2xl bg-[#F6F7FB] p-6">
            <div>
              <p className="font-display text-xl font-bold text-[#252A34]">24/7 availability</p>
              <p className="mt-2 text-xs leading-relaxed text-[#646B7A]">
                Check live unit availability and reserve exact rental dates anytime.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/products')}
              aria-label="Browse live availability"
              className="mt-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#252A34] text-white transition-colors hover:bg-[#5478D5]"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Card 2: Dark Charcoal */}
          <div className="flex min-h-[190px] flex-col justify-between rounded-2xl bg-[#1F242D] p-6 text-white">
            <div>
              <p className="font-display text-xl font-bold">Up to 75% Saved</p>
              <p className="mt-2 text-xs leading-relaxed text-white/75">
                Pay transparent daily rental rates instead of full retail purchase costs.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/products')}
              aria-label="Explore affordable rentals"
              className="mt-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#252A34] transition-colors hover:bg-[#E9EDFF]"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Card 3: Equipment Inspection Photo with Measured Scrim */}
          <div className="relative flex min-h-[190px] flex-col justify-between overflow-hidden rounded-2xl bg-[#252A34] p-6 text-white">
            <img
              src={LIFESTYLE_PHOTOS.verifiedCondition}
              alt="Hands inspecting DSLR camera lens and rental kit inside protective foam case"
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/25" />
            <div className="relative z-10">
              <p className="font-display text-xl font-bold">Verified Condition</p>
              <p className="mt-1.5 text-xs text-white/85">
                Pre-rental inspection notes &amp; photo return reports on every booking.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/orders')}
              aria-label="View return condition reports"
              className="relative z-10 mt-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#252A34] transition-colors hover:bg-[#E9EDFF]"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Card 4: Dark Charcoal */}
          <div className="flex min-h-[190px] flex-col justify-between rounded-2xl bg-[#1F242D] p-6 text-white">
            <div>
              <p className="font-display text-xl font-bold">Smart Bundles</p>
              <p className="mt-2 text-xs leading-relaxed text-white/75">
                Ready-made Photography, Camping, and Presentation kits with instant savings.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/products', { category: 'bundles' })}
              aria-label="View Smart Rental Bundles"
              className="mt-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#252A34] transition-colors hover:bg-[#E9EDFF]"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Card 5: Real Photo with Measured Scrim */}
          <div className="relative flex min-h-[190px] flex-col justify-between overflow-hidden rounded-2xl bg-[#252A34] p-6 text-white">
            <img
              src={LIFESTYLE_PHOTOS.livingRoom}
              alt="Clutter-free modern living room"
              loading="lazy"
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/25" />
            <div className="relative z-10">
              <p className="font-display text-xl font-bold">
                {categories.length}+ Categories
              </p>
              <p className="mt-1.5 text-xs text-white/85">
                Keep your space clutter-free across photography, audio, camping &amp; campus tools.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/products')}
              aria-label="Browse all categories"
              className="relative z-10 mt-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#252A34] transition-colors hover:bg-[#E9EDFF]"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Card 6: Light */}
          <div className="flex min-h-[190px] flex-col justify-between rounded-2xl bg-[#F6F7FB] p-6">
            <div>
              <p className="font-display text-xl font-bold text-[#252A34]">
                Earn from Unused Gear
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[#646B7A]">
                Apply to become a Rental Provider and turn idle equipment into daily income.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(providerRoute)}
              aria-label="Become a Rental Provider"
              className="mt-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#252A34] text-white transition-colors hover:bg-[#5478D5]"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Card 7: Dark Charcoal */}
          <div className="flex min-h-[190px] flex-col justify-between rounded-2xl bg-[#1F242D] p-6 text-white">
            <div>
              <p className="font-display text-xl font-bold">Instant Borrowing</p>
              <p className="mt-2 text-xs leading-relaxed text-white/75">
                Multi-vendor cart checkout with Cash on Delivery or demo online confirmation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/products')}
              aria-label="Start borrowing"
              className="mt-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#252A34] transition-colors hover:bg-[#E9EDFF]"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Card 8: Light */}
          <div className="flex min-h-[190px] flex-col justify-between rounded-2xl bg-[#F6F7FB] p-6">
            <div>
              <p className="font-display text-xl font-bold text-[#252A34]">
                Eco-Friendly Lifestyle
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[#646B7A]">
                Reduce duplicate electronics waste by sharing trusted gear across your campus.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/products')}
              aria-label="Explore sustainable rentals"
              className="mt-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#252A34] text-white transition-colors hover:bg-[#5478D5]"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 4. Easy Way to Get Started + Why Borrowing Beats Buying (Inspired by Screen 2 of Reference) */}
      <section id="how-it-works" className="border-t border-[#E5E8F0] bg-[#F6F7FB] py-16">
        <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-12">
            {/* Left: Generated Rental Kit Preparation Photo + Provider Quote Card */}
            <div className="relative lg:col-span-6">
              <div className="overflow-hidden rounded-2xl border border-[#E5E8F0] bg-white">
                <img
                  src={LIFESTYLE_PHOTOS.howItWorksKit}
                  alt="Creators preparing DSLR camera, tripod, portable projector, and rental case for pickup"
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover"
                />
              </div>
              <div className="mt-4 rounded-2xl border border-[#E5E8F0] bg-white p-5 shadow-sm sm:mt-4">
                <p className="text-xs leading-relaxed font-medium text-[#252A34]">
                  &ldquo;Listing my spare camera and portable projector on BorrowBox lets campus
                  creators rent inspected gear while my equipment pays for itself.&rdquo;
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-medium text-[#646B7A]">
                    Verified Campus Provider · Studio Rental Kit
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate(providerRoute)}
                    className="rounded-full bg-[#252A34] px-3.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#5478D5] whitespace-nowrap"
                  >
                    {user?.role === 'provider' ? 'Manage Listings' : 'Start Listing'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Easy Way to Get Started 3-Step Card */}
            <div className="lg:col-span-6">
              <p className="text-xs font-semibold text-[#5478D5]">How it works</p>
              <h2 className="font-display mt-1 text-3xl font-bold tracking-tight text-[#252A34]">
                Easy Way to Get Started
              </h2>
              <p className="mt-2 text-sm text-[#646B7A]">
                Join in minutes and start borrowing equipment or earning from your own gear.
              </p>

              <div className="mt-6 divide-y divide-[#E5E8F0] rounded-2xl border border-[#E5E8F0] bg-white">
                <div className="flex items-start justify-between gap-4 p-5">
                  <div>
                    <h3 className="font-display text-sm font-bold text-[#252A34]">Sign Up</h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#646B7A]">
                      Create your BorrowBox account with Google or email in under a minute.
                    </p>
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#646B7A]">01</span>
                </div>
                <div className="flex items-start justify-between gap-4 p-5">
                  <div>
                    <h3 className="font-display text-sm font-bold text-[#252A34]">
                      Browse or List Gear
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#646B7A]">
                      Pick exact rental dates with live stock verification, or apply as a Rental
                      Provider to upload your own listings.
                    </p>
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#646B7A]">02</span>
                </div>
                <div className="flex items-start justify-between gap-4 p-5">
                  <div>
                    <h3 className="font-display text-sm font-bold text-[#252A34]">
                      Borrow, Return &amp; Earn
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#646B7A]">
                      Track your rental status, submit return condition photos, and build verified
                      marketplace trust.
                    </p>
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#646B7A]">03</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('/products')}
                className="mt-5 w-full min-h-[44px] rounded-full bg-[#252A34] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#5478D5]"
              >
                Get Started
              </button>
            </div>
          </div>

          {/* Why Borrowing Beats Buying */}
          <div className="mt-16 border-t border-[#E5E8F0] pt-14">
            <h2 className="font-display text-center text-2xl font-bold tracking-tight text-[#252A34] sm:text-3xl">
              Why borrowing beats buying
            </h2>
            <div className="mx-auto mt-10 grid max-w-4xl gap-x-10 gap-y-7 sm:grid-cols-2">
              <div className="flex items-start gap-3.5">
                <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-[#5478D5]" />
                <div>
                  <h3 className="font-display text-sm font-bold text-[#252A34]">
                    Cut Down Big Expenses
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#646B7A]">
                    Stop spending thousands on cameras, calculators, or tents you only need for a few
                    days.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[#5478D5]" />
                <div>
                  <h3 className="font-display text-sm font-bold text-[#252A34]">
                    Stay Flexible With Your Needs
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#646B7A]">
                    Borrow for a single exam, a weekend shoot, or an event — with zero long-term
                    commitment.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#5478D5]" />
                <div>
                  <h3 className="font-display text-sm font-bold text-[#252A34]">
                    Verified Pre-Rental Condition
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#646B7A]">
                    Every listing displays inspected condition status and supports photo-verified
                    returns.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <Users className="mt-0.5 h-5 w-5 shrink-0 text-[#5478D5]" />
                <div>
                  <h3 className="font-display text-sm font-bold text-[#252A34]">
                    Trusted Multi-Vendor Marketplace
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#646B7A]">
                    Admin-approved rental providers ensure every listing meets quality and safety
                    standards.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <Leaf className="mt-0.5 h-5 w-5 shrink-0 text-[#5478D5]" />
                <div>
                  <h3 className="font-display text-sm font-bold text-[#252A34]">
                    Live Clutter-Free
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#646B7A]">
                    Keep dorm rooms and studios neat by skipping gear that would otherwise gather
                    dust.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#5478D5]" />
                <div>
                  <h3 className="font-display text-sm font-bold text-[#252A34]">
                    Earn While You Lend
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#646B7A]">
                    Switch smoothly between renting items and managing your own provider listings from
                    one account.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
