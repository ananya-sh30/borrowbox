import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  IndianRupee,
  Layers,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  X,
} from 'lucide-react';
import type { Bundle, Category, Product, ProductCondition } from '../types';
import { apiRequest, formatInr, getTodayDateString } from '../lib/api';
import { ProductImage } from '../components/ProductImage';
import { CategoryTabSvg } from '../components/CategorySvgs';

interface ProductsPageProps {
  products: Product[];
  categories: Category[];
  bundles: Bundle[];
  search: string;
  selectedCategory: string;
  sortBy: 'newest' | 'price_asc' | 'price_desc';
  onSearchChange: (val: string) => void;
  onCategoryChange: (cat: string) => void;
  onSortChange: (sort: 'newest' | 'price_asc' | 'price_desc') => void;
  onSelectProduct: (product: Product) => void;
  onSelectBundle: (bundle: Bundle) => void;
  onQuickAddProduct: (
    product: Product,
    dateRange?: { startDate: string; endDate: string },
  ) => void;
}

type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'name_asc';

interface PriceTier {
  id: string;
  label: string;
  min: number;
  max: number | null;
}

const PRICE_TIERS: PriceTier[] = [
  { id: 'under_150', label: 'Under ₹150 / day', min: 0, max: 149 },
  { id: '150_350', label: '₹150 – ₹350 / day', min: 150, max: 350 },
  { id: '350_600', label: '₹351 – ₹600 / day', min: 351, max: 600 },
  { id: 'over_600', label: '₹601+ / day', min: 601, max: null },
];

const CONDITION_OPTIONS: ProductCondition[] = ['Mint', 'Good', 'Fair'];

interface AvailabilityResponse {
  startDate: string;
  endDate: string;
  days: number;
  availableUnitsByProductId: Record<string, number>;
  availableUnitsByBundleId: Record<string, number>;
}

export function ProductsPage({
  products,
  categories,
  bundles,
  search,
  selectedCategory,
  sortBy,
  onSearchChange,
  onCategoryChange,
  onSortChange,
  onSelectProduct,
  onSelectBundle,
  onQuickAddProduct,
}: ProductsPageProps) {
  const categoryStripRef = useRef<HTMLDivElement | null>(null);
  const today = getTodayDateString();

  // Left-sidebar filter states
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [localSort, setLocalSort] = useState<SortOption>(sortBy);
  const [showIndividual, setShowIndividual] = useState(true);
  const [showBundles, setShowBundles] = useState(true);
  const [inStockOnly, setInStockOnly] = useState(false);

  // Availability date range filter
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [availabilityMap, setAvailabilityMap] = useState<AvailabilityResponse | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');

  // Price filter
  const [selectedPriceTiers, setSelectedPriceTiers] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // Condition, City, Provider filters
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [citySearch, setCitySearch] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);

  // Accordion open/collapse state
  const [openSections, setOpenSections] = useState({
    format: true,
    dates: true,
    price: true,
    condition: true,
    city: true,
    provider: false,
  });

  useEffect(() => {
    setLocalSort(sortBy);
  }, [sortBy]);

  // Live server-backed availability check whenever both dates are selected
  useEffect(() => {
    if (!startDate || !endDate) {
      setAvailabilityMap(null);
      setAvailabilityError('');
      return;
    }
    if (endDate < startDate) {
      setAvailabilityMap(null);
      setAvailabilityError('End date must be on or after start date.');
      return;
    }

    let cancelled = false;
    setAvailabilityLoading(true);
    setAvailabilityError('');
    apiRequest<AvailabilityResponse>(
      `/api/availability?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
    )
      .then((res) => {
        if (!cancelled) {
          setAvailabilityMap(res);
          setAvailabilityLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAvailabilityMap(null);
          setAvailabilityError(
            err instanceof Error ? err.message : 'Unable to check dates.',
          );
          setAvailabilityLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const scrollCategories = (direction: 'left' | 'right') => {
    const el = categoryStripRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -280 : 280, behavior: 'smooth' });
  };

  // Dynamic facet counts based on approved catalog
  const cityCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      const city = (p.providerCity || 'Bengaluru').trim();
      map.set(city, (map.get(city) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [products]);

  const visibleCities = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    if (!q) return cityCounts;
    return cityCounts.filter(([city]) => city.toLowerCase().includes(q));
  }, [cityCounts, citySearch]);

  const providerCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      const name = (p.providerName || 'BorrowBox Verified Hub').trim();
      map.set(name, (map.get(name) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [products]);

  const conditionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      map.set(p.condition, (map.get(p.condition) || 0) + 1);
    }
    return CONDITION_OPTIONS.map((c) => ({ condition: c, count: map.get(c) || 0 }));
  }, [products]);

  const priceTierCounts = useMemo(() => {
    return PRICE_TIERS.map((tier) => ({
      ...tier,
      count: products.filter(
        (p) => p.pricePerDay >= tier.min && (tier.max === null || p.pricePerDay <= tier.max),
      ).length,
    }));
  }, [products]);

  const matchesPriceFilter = (pricePerDay: number): boolean => {
    const minVal = minPrice.trim() ? Number(minPrice) : null;
    const maxVal = maxPrice.trim() ? Number(maxPrice) : null;
    if (minVal !== null && !Number.isNaN(minVal) && pricePerDay < minVal) return false;
    if (maxVal !== null && !Number.isNaN(maxVal) && pricePerDay > maxVal) return false;

    if (selectedPriceTiers.length > 0) {
      const tierMatch = selectedPriceTiers.some((tierId) => {
        const tier = PRICE_TIERS.find((t) => t.id === tierId);
        if (!tier) return false;
        return pricePerDay >= tier.min && (tier.max === null || pricePerDay <= tier.max);
      });
      if (!tierMatch) return false;
    }
    return true;
  };

  const dateFilterActive = Boolean(availabilityMap && startDate && endDate && !availabilityError);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'bundles' || !showIndividual) return [];
    const q = search.trim().toLowerCase();

    const list = products.filter((p) => {
      const catMatch =
        selectedCategory === 'all' ||
        p.categoryName.toLowerCase() === selectedCategory.toLowerCase() ||
        p.categoryId === selectedCategory;
      if (!catMatch) return false;

      if (q) {
        const textMatch =
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.providerName || '').toLowerCase().includes(q) ||
          (p.providerCity || '').toLowerCase().includes(q);
        if (!textMatch) return false;
      }

      if (inStockOnly && (!p.available || p.totalUnits <= 0)) return false;

      if (dateFilterActive && availabilityMap) {
        const free = availabilityMap.availableUnitsByProductId[p.id] ?? 0;
        if (free <= 0) return false;
      }

      if (!matchesPriceFilter(p.pricePerDay)) return false;

      if (selectedConditions.length > 0 && !selectedConditions.includes(p.condition)) {
        return false;
      }

      const city = (p.providerCity || 'Bengaluru').trim();
      if (selectedCities.length > 0 && !selectedCities.includes(city)) {
        return false;
      }

      const provider = (p.providerName || 'BorrowBox Verified Hub').trim();
      if (selectedProviders.length > 0 && !selectedProviders.includes(provider)) {
        return false;
      }

      return true;
    });

    if (localSort === 'price_asc') {
      return [...list].sort((a, b) => a.pricePerDay - b.pricePerDay);
    }
    if (localSort === 'price_desc') {
      return [...list].sort((a, b) => b.pricePerDay - a.pricePerDay);
    }
    if (localSort === 'name_asc') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [
    products,
    selectedCategory,
    showIndividual,
    search,
    inStockOnly,
    dateFilterActive,
    availabilityMap,
    selectedPriceTiers,
    minPrice,
    maxPrice,
    selectedConditions,
    selectedCities,
    selectedProviders,
    localSort,
  ]);

  const filteredBundles = useMemo(() => {
    if (selectedCategory !== 'all' && selectedCategory !== 'bundles') return [];
    if (selectedCategory !== 'bundles' && !showBundles) return [];
    const q = search.trim().toLowerCase();

    const list = bundles.filter((b) => {
      if (q) {
        const match =
          b.name.toLowerCase().includes(q) ||
          b.code.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q) ||
          b.products.some((p) => p.name.toLowerCase().includes(q));
        if (!match) return false;
      }
      if (inStockOnly && (!b.available || b.availableUnits <= 0)) return false;

      if (dateFilterActive && availabilityMap) {
        const free = availabilityMap.availableUnitsByBundleId[b.id] ?? 0;
        if (free <= 0) return false;
      }

      if (!matchesPriceFilter(b.bundlePricePerDay)) return false;

      if (
        selectedConditions.length > 0 &&
        !b.products.some((p) => selectedConditions.includes(p.condition))
      ) {
        return false;
      }

      if (
        selectedCities.length > 0 &&
        !b.products.some((p) => selectedCities.includes((p.providerCity || 'Bengaluru').trim()))
      ) {
        return false;
      }

      if (
        selectedProviders.length > 0 &&
        !b.products.some((p) =>
          selectedProviders.includes((p.providerName || 'BorrowBox Verified Hub').trim()),
        )
      ) {
        return false;
      }

      return true;
    });

    if (localSort === 'price_asc') {
      return [...list].sort((a, b) => a.bundlePricePerDay - b.bundlePricePerDay);
    }
    if (localSort === 'price_desc') {
      return [...list].sort((a, b) => b.bundlePricePerDay - a.bundlePricePerDay);
    }
    if (localSort === 'name_asc') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [
    bundles,
    selectedCategory,
    showBundles,
    search,
    inStockOnly,
    dateFilterActive,
    availabilityMap,
    selectedPriceTiers,
    minPrice,
    maxPrice,
    selectedConditions,
    selectedCities,
    selectedProviders,
    localSort,
  ]);

  const totalVisibleCount = filteredProducts.length + filteredBundles.length;

  const toggleArrayValue = (list: string[], value: string, setter: (next: string[]) => void) => {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  const clearAllFilters = () => {
    onSearchChange('');
    onCategoryChange('all');
    setShowIndividual(true);
    setShowBundles(true);
    setInStockOnly(false);
    setStartDate('');
    setEndDate('');
    setAvailabilityMap(null);
    setAvailabilityError('');
    setSelectedPriceTiers([]);
    setMinPrice('');
    setMaxPrice('');
    setSelectedConditions([]);
    setSelectedCities([]);
    setCitySearch('');
    setSelectedProviders([]);
  };

  // Build active removable filter chips
  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (selectedCategory !== 'all') {
    activeChips.push({
      key: `cat-${selectedCategory}`,
      label: selectedCategory === 'bundles' ? 'Smart Bundles' : selectedCategory,
      onRemove: () => onCategoryChange('all'),
    });
  }
  if (search.trim()) {
    activeChips.push({
      key: 'search',
      label: `"${search.trim()}"`,
      onRemove: () => onSearchChange(''),
    });
  }
  if (!showIndividual || !showBundles) {
    activeChips.push({
      key: 'format',
      label: showBundles && !showIndividual ? 'Bundles Only' : 'Equipment Only',
      onRemove: () => {
        setShowIndividual(true);
        setShowBundles(true);
      },
    });
  }
  if (inStockOnly) {
    activeChips.push({
      key: 'stock',
      label: 'In Stock Only',
      onRemove: () => setInStockOnly(false),
    });
  }
  if (startDate && endDate && !availabilityError) {
    activeChips.push({
      key: 'dates',
      label: `${startDate} to ${endDate}`,
      onRemove: () => {
        setStartDate('');
        setEndDate('');
      },
    });
  }
  for (const tierId of selectedPriceTiers) {
    const tier = PRICE_TIERS.find((t) => t.id === tierId);
    if (tier) {
      activeChips.push({
        key: `tier-${tierId}`,
        label: tier.label,
        onRemove: () => toggleArrayValue(selectedPriceTiers, tierId, setSelectedPriceTiers),
      });
    }
  }
  if (minPrice.trim() || maxPrice.trim()) {
    activeChips.push({
      key: 'custom-price',
      label: `₹${minPrice || '0'} – ₹${maxPrice || 'Max'}/day`,
      onRemove: () => {
        setMinPrice('');
        setMaxPrice('');
      },
    });
  }
  for (const cond of selectedConditions) {
    activeChips.push({
      key: `cond-${cond}`,
      label: `Condition: ${cond}`,
      onRemove: () => toggleArrayValue(selectedConditions, cond, setSelectedConditions),
    });
  }
  for (const city of selectedCities) {
    activeChips.push({
      key: `city-${city}`,
      label: city,
      onRemove: () => toggleArrayValue(selectedCities, city, setSelectedCities),
    });
  }
  for (const prov of selectedProviders) {
    activeChips.push({
      key: `prov-${prov}`,
      label: prov,
      onRemove: () => toggleArrayValue(selectedProviders, prov, setSelectedProviders),
    });
  }

  const categoryTabs = [
    { key: 'all', label: 'All Rentals' },
    { key: 'bundles', label: 'Smart Bundles' },
    ...categories.map((c) => ({ key: c.name, label: c.name })),
  ];

  const handleSortSelect = (value: SortOption) => {
    setLocalSort(value);
    if (value === 'newest' || value === 'price_asc' || value === 'price_desc') {
      onSortChange(value);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB]/50 py-8">
      <div className="mx-auto max-w-[1260px] px-4 sm:px-6">
        {/* Top Title + Live Item Count */}
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-[#252A34]">
              Explore Rentals
            </h1>
            <p className="mt-1 text-xs text-[#646B7A]">
              Compare verified provider listings, filter by live availability dates, or rent Smart Bundles.
            </p>
          </div>
          <p className="text-sm font-medium text-[#646B7A] tabular-nums">
            {totalVisibleCount} {totalVisibleCount === 1 ? 'Item' : 'Items'}
          </p>
        </div>

        {/* Top Horizontal Category Icon Strip with < and > Arrows (Inspired by Reference) */}
        <div className="mt-5 flex items-stretch overflow-hidden rounded-xl border border-[#E5E8F0] bg-white shadow-2xs">
          <button
            type="button"
            onClick={() => scrollCategories('left')}
            aria-label="Scroll categories left"
            className="flex w-10 shrink-0 items-center justify-center border-r border-[#E5E8F0] text-[#646B7A] transition-colors hover:bg-[#F6F7FB] hover:text-[#252A34]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div
            ref={categoryStripRef}
            className="flex flex-1 divide-x divide-[#E5E8F0] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {categoryTabs.map((tab) => {
              const isActive = selectedCategory.toLowerCase() === tab.key.toLowerCase();
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onCategoryChange(tab.key)}
                  className={`group flex min-w-[124px] flex-1 flex-col items-center justify-center gap-2 border-b-2 px-4 py-3.5 text-center transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-b-[#5478D5] bg-[#E9EDFF]/35 text-[#252A34]'
                      : 'border-b-transparent bg-white text-[#646B7A] hover:bg-[#F6F7FB] hover:text-[#252A34]'
                  }`}
                >
                  <CategoryTabSvg
                    categoryKey={tab.key}
                    className={`h-8 w-8 transition-transform duration-150 group-hover:scale-105 ${
                      isActive ? 'scale-105' : ''
                    }`}
                  />
                  <span
                    className={`text-xs ${
                      isActive ? 'font-semibold text-[#5478D5]' : 'font-medium'
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => scrollCategories('right')}
            aria-label="Scroll categories right"
            className="flex w-10 shrink-0 items-center justify-center border-l border-[#E5E8F0] text-[#646B7A] transition-colors hover:bg-[#F6F7FB] hover:text-[#252A34]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* FILTER Chips + SORT BY Bar */}
        <div className="mt-5 flex flex-col gap-3 border-b border-[#E5E8F0] pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#252A34] lg:hidden"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#5478D5]" />
              <span>{mobileFiltersOpen ? 'Hide Filters' : 'Filters'}</span>
              {activeChips.length > 0 && (
                <span className="ml-0.5 font-mono text-[#5478D5]">({activeChips.length})</span>
              )}
            </button>

            <span className="text-[11px] font-bold tracking-wider text-[#646B7A] uppercase">
              Filter:
            </span>

            {activeChips.length === 0 ? (
              <span className="text-xs text-[#646B7A]">All approved items &amp; bundles</span>
            ) : (
              <>
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.onRemove}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E8F0] bg-white px-2.5 py-1 text-xs font-medium text-[#252A34] transition-colors hover:border-[#5478D5] hover:text-[#5478D5]"
                  >
                    <span>{chip.label}</span>
                    <X className="h-3 w-3 text-[#646B7A]" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-lg border border-[#E5E8F0] bg-white px-2.5 py-1 text-xs font-semibold text-[#5478D5] transition-colors hover:bg-[#E9EDFF]/50"
                >
                  Clear All
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5 self-start lg:self-auto">
            <label
              htmlFor="catalogue-sort"
              className="text-[11px] font-bold tracking-wider text-[#646B7A] uppercase whitespace-nowrap"
            >
              Sort by:
            </label>
            <select
              id="catalogue-sort"
              value={localSort}
              onChange={(e) => handleSortSelect(e.target.value as SortOption)}
              className="rounded-lg border border-[#E5E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#252A34] focus:border-[#5478D5] focus:outline-none"
            >
              <option value="newest">Newest Listings</option>
              <option value="price_asc">Daily Rate: Low to High</option>
              <option value="price_desc">Daily Rate: High to Low</option>
              <option value="name_asc">Name: A to Z</option>
            </select>
          </div>
        </div>

        {/* Main 2-Column Catalog Layout: Left Filter Sidebar + Right 3-Col Cards */}
        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT FILTER SIDEBAR */}
          <aside
            className={`${
              mobileFiltersOpen ? 'block' : 'hidden'
            } space-y-4 lg:col-span-3 lg:block`}
          >
            {/* Keyword Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#646B7A]" />
              <input
                type="search"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search by keyword..."
                className="w-full rounded-xl border border-[#E5E8F0] bg-white py-2.5 pr-3 pl-9 text-xs text-[#252A34] placeholder:text-[#646B7A] focus:border-[#5478D5] focus:outline-none"
              />
            </div>

            {/* Structured Accordion Filter Card */}
            <div className="divide-y divide-[#E5E8F0] rounded-xl border border-[#E5E8F0] bg-white">
              {/* 1. Availability & Rental Dates */}
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSection('dates')}
                    className="flex flex-1 items-center gap-2 text-left text-xs font-semibold text-[#252A34]"
                  >
                    <Calendar className="h-4 w-4 text-[#5478D5]" />
                    <span>Availability &amp; Dates</span>
                  </button>
                  <div className="flex items-center gap-2">
                    {(startDate || endDate || inStockOnly) && (
                      <button
                        type="button"
                        onClick={() => {
                          setStartDate('');
                          setEndDate('');
                          setInStockOnly(false);
                        }}
                        className="text-[11px] font-semibold text-[#5478D5] hover:underline"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleSection('dates')}
                      aria-label="Toggle availability dates filter"
                      className="text-[#646B7A]"
                    >
                      {openSections.dates ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {openSections.dates && (
                  <div className="mt-3 space-y-2.5">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-[#252A34]">
                      <input
                        type="checkbox"
                        checked={inStockOnly}
                        onChange={(e) => setInStockOnly(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-[#E5E8F0] accent-[#5478D5]"
                      />
                      <span>In Stock Ready to Book</span>
                    </label>

                    <div className="grid grid-cols-1 gap-2 pt-1">
                      <div>
                        <label
                          htmlFor="filter-start-date"
                          className="block text-[11px] font-medium text-[#646B7A]"
                        >
                          Pickup Date
                        </label>
                        <input
                          id="filter-start-date"
                          type="date"
                          min={today}
                          value={startDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStartDate(val);
                            if (val && (!endDate || endDate < val)) {
                              setEndDate(val);
                            }
                          }}
                          className="mt-1 w-full rounded-lg border border-[#E5E8F0] bg-[#F6F7FB] px-2.5 py-1.5 text-xs text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="filter-end-date"
                          className="block text-[11px] font-medium text-[#646B7A]"
                        >
                          Return Date
                        </label>
                        <input
                          id="filter-end-date"
                          type="date"
                          min={startDate || today}
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-[#E5E8F0] bg-[#F6F7FB] px-2.5 py-1.5 text-xs text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>

                    {availabilityLoading && (
                      <p className="text-[11px] text-[#5478D5]">Checking live unit schedule...</p>
                    )}
                    {availabilityError && (
                      <p className="text-[11px] font-medium text-[#DC2626]">{availabilityError}</p>
                    )}
                    {dateFilterActive && availabilityMap && (
                      <p className="rounded-lg bg-[#E9EDFF]/50 px-2.5 py-1.5 text-[11px] font-medium text-[#5478D5]">
                        Showing items free for {availabilityMap.days}{' '}
                        {availabilityMap.days === 1 ? 'day' : 'days'} ({startDate} → {endDate})
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Rental Format */}
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSection('format')}
                    className="flex flex-1 items-center gap-2 text-left text-xs font-semibold text-[#252A34]"
                  >
                    <Layers className="h-4 w-4 text-[#5478D5]" />
                    <span>Rental Format</span>
                  </button>
                  <div className="flex items-center gap-2">
                    {(!showIndividual || !showBundles) && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowIndividual(true);
                          setShowBundles(true);
                        }}
                        className="text-[11px] font-semibold text-[#5478D5] hover:underline"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleSection('format')}
                      aria-label="Toggle rental format filter"
                      className="text-[#646B7A]"
                    >
                      {openSections.format ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {openSections.format && (
                  <div className="mt-3 space-y-2">
                    <label className="flex cursor-pointer items-center justify-between text-xs text-[#252A34]">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={showIndividual}
                          onChange={(e) => setShowIndividual(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-[#E5E8F0] accent-[#5478D5]"
                        />
                        <span>Individual Equipment</span>
                      </span>
                      <span className="text-[11px] text-[#646B7A] tabular-nums">
                        ({products.length})
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-center justify-between text-xs text-[#252A34]">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={showBundles}
                          onChange={(e) => setShowBundles(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-[#E5E8F0] accent-[#5478D5]"
                        />
                        <span>Smart Bundles</span>
                      </span>
                      <span className="text-[11px] text-[#646B7A] tabular-nums">
                        ({bundles.length})
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* 3. Daily Price Range */}
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSection('price')}
                    className="flex flex-1 items-center gap-2 text-left text-xs font-semibold text-[#252A34]"
                  >
                    <IndianRupee className="h-4 w-4 text-[#5478D5]" />
                    <span>Price Range (₹/day)</span>
                  </button>
                  <div className="flex items-center gap-2">
                    {(selectedPriceTiers.length > 0 || minPrice || maxPrice) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPriceTiers([]);
                          setMinPrice('');
                          setMaxPrice('');
                        }}
                        className="text-[11px] font-semibold text-[#5478D5] hover:underline"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleSection('price')}
                      aria-label="Toggle price range filter"
                      className="text-[#646B7A]"
                    >
                      {openSections.price ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {openSections.price && (
                  <div className="mt-3 space-y-2.5">
                    <div className="space-y-2">
                      {priceTierCounts.map((tier) => (
                        <label
                          key={tier.id}
                          className="flex cursor-pointer items-center justify-between text-xs text-[#252A34]"
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedPriceTiers.includes(tier.id)}
                              onChange={() =>
                                toggleArrayValue(
                                  selectedPriceTiers,
                                  tier.id,
                                  setSelectedPriceTiers,
                                )
                              }
                              className="h-3.5 w-3.5 rounded border-[#E5E8F0] accent-[#5478D5]"
                            />
                            <span>{tier.label}</span>
                          </span>
                          <span className="text-[11px] text-[#646B7A] tabular-nums">
                            ({tier.count})
                          </span>
                        </label>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <input
                        type="number"
                        min={0}
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        placeholder="Min ₹"
                        aria-label="Minimum daily rate"
                        className="w-full rounded-lg border border-[#E5E8F0] bg-[#F6F7FB] px-2.5 py-1.5 text-xs text-[#252A34] placeholder:text-[#646B7A] focus:border-[#5478D5] focus:bg-white focus:outline-none"
                      />
                      <input
                        type="number"
                        min={0}
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        placeholder="Max ₹"
                        aria-label="Maximum daily rate"
                        className="w-full rounded-lg border border-[#E5E8F0] bg-[#F6F7FB] px-2.5 py-1.5 text-xs text-[#252A34] placeholder:text-[#646B7A] focus:border-[#5478D5] focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Item Condition */}
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSection('condition')}
                    className="flex flex-1 items-center gap-2 text-left text-xs font-semibold text-[#252A34]"
                  >
                    <ShieldCheck className="h-4 w-4 text-[#5478D5]" />
                    <span>Condition</span>
                  </button>
                  <div className="flex items-center gap-2">
                    {selectedConditions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedConditions([])}
                        className="text-[11px] font-semibold text-[#5478D5] hover:underline"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleSection('condition')}
                      aria-label="Toggle condition filter"
                      className="text-[#646B7A]"
                    >
                      {openSections.condition ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {openSections.condition && (
                  <div className="mt-3 space-y-2">
                    {conditionCounts.map(({ condition, count }) => (
                      <label
                        key={condition}
                        className="flex cursor-pointer items-center justify-between text-xs text-[#252A34]"
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedConditions.includes(condition)}
                            onChange={() =>
                              toggleArrayValue(
                                selectedConditions,
                                condition,
                                setSelectedConditions,
                              )
                            }
                            className="h-3.5 w-3.5 rounded border-[#E5E8F0] accent-[#5478D5]"
                          />
                          <span>{condition}</span>
                        </span>
                        <span className="text-[11px] text-[#646B7A] tabular-nums">({count})</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. Provider City */}
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSection('city')}
                    className="flex flex-1 items-center gap-2 text-left text-xs font-semibold text-[#252A34]"
                  >
                    <MapPin className="h-4 w-4 text-[#5478D5]" />
                    <span>City / Location</span>
                  </button>
                  <div className="flex items-center gap-2">
                    {selectedCities.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedCities([])}
                        className="text-[11px] font-semibold text-[#5478D5] hover:underline"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleSection('city')}
                      aria-label="Toggle city filter"
                      className="text-[#646B7A]"
                    >
                      {openSections.city ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {openSections.city && (
                  <div className="mt-3 space-y-2.5">
                    <div className="relative">
                      <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#646B7A]" />
                      <input
                        type="search"
                        value={citySearch}
                        onChange={(e) => setCitySearch(e.target.value)}
                        placeholder="Search by city"
                        className="w-full rounded-lg border border-[#E5E8F0] bg-[#F6F7FB] py-1.5 pr-2.5 pl-8 text-xs text-[#252A34] placeholder:text-[#646B7A] focus:border-[#5478D5] focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                      {visibleCities.map(([city, count]) => (
                        <label
                          key={city}
                          className="flex cursor-pointer items-center justify-between text-xs text-[#252A34]"
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedCities.includes(city)}
                              onChange={() =>
                                toggleArrayValue(selectedCities, city, setSelectedCities)
                              }
                              className="h-3.5 w-3.5 rounded border-[#E5E8F0] accent-[#5478D5]"
                            />
                            <span className="truncate">{city}</span>
                          </span>
                          <span className="text-[11px] text-[#646B7A] tabular-nums">({count})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Rental Provider Store */}
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSection('provider')}
                    className="flex flex-1 items-center gap-2 text-left text-xs font-semibold text-[#252A34]"
                  >
                    <Store className="h-4 w-4 text-[#5478D5]" />
                    <span>Rental Provider</span>
                  </button>
                  <div className="flex items-center gap-2">
                    {selectedProviders.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedProviders([])}
                        className="text-[11px] font-semibold text-[#5478D5] hover:underline"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleSection('provider')}
                      aria-label="Toggle provider filter"
                      className="text-[#646B7A]"
                    >
                      {openSections.provider ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {openSections.provider && (
                  <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
                    {providerCounts.map(([prov, count]) => (
                      <label
                        key={prov}
                        className="flex cursor-pointer items-center justify-between gap-2 text-xs text-[#252A34]"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedProviders.includes(prov)}
                            onChange={() =>
                              toggleArrayValue(selectedProviders, prov, setSelectedProviders)
                            }
                            className="h-3.5 w-3.5 shrink-0 rounded border-[#E5E8F0] accent-[#5478D5]"
                          />
                          <span className="truncate">{prov}</span>
                        </span>
                        <span className="shrink-0 text-[11px] text-[#646B7A] tabular-nums">
                          ({count})
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* RIGHT CATALOG GRID */}
          <div className="lg:col-span-9">
            {totalVisibleCount === 0 ? (
              <div className="rounded-2xl border border-[#E5E8F0] bg-white px-6 py-16 text-center">
                <p className="font-display text-lg font-semibold text-[#252A34]">
                  No matching rentals found
                </p>
                <p className="mt-1.5 text-sm text-[#646B7A]">
                  Try adjusting your price range, rental dates, or clearing active filters.
                </p>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="mt-5 rounded-xl bg-[#5478D5] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4365BE]"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Smart Bundles Grid (when applicable) */}
                {filteredBundles.length > 0 && (
                  <section>
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="font-display flex items-center gap-2 text-lg font-bold text-[#252A34]">
                        <Layers className="h-4 w-4 text-[#5478D5]" />
                        <span>Smart Rental Bundles ({filteredBundles.length})</span>
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                      {filteredBundles.map((bundle) => {
                        const freeBundleUnits = dateFilterActive
                          ? (availabilityMap?.availableUnitsByBundleId[bundle.id] ?? 0)
                          : bundle.availableUnits;

                        return (
                          <div
                            key={bundle.id}
                            className="group flex flex-col overflow-hidden rounded-xl border border-[#E5E8F0] bg-white transition-shadow duration-200 hover:shadow-md"
                          >
                            <div className="relative">
                              <ProductImage
                                src={bundle.image}
                                alt={bundle.name}
                                categoryName="Smart Rental Bundle"
                                aspectClass="aspect-[4/3]"
                              />
                              <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-md border border-[#E5E8F0] bg-white/95 px-2 py-1 text-[11px] font-semibold text-[#299B68] backdrop-blur-xs">
                                <Layers className="h-3 w-3 text-[#5478D5]" />
                                {bundle.savingsPerDay > 0
                                  ? `Save ${formatInr(bundle.savingsPerDay)}/day`
                                  : `${bundle.products.length}-Item Bundle`}
                              </span>
                            </div>

                            <div className="flex flex-1 flex-col justify-between p-4">
                              <div>
                                <h3 className="font-display line-clamp-1 text-base font-bold text-[#252A34]">
                                  {bundle.name}
                                </h3>
                                <p className="mt-0.5 text-xs text-[#646B7A]">
                                  Curated Kit · {bundle.products.length} items included
                                </p>
                                <ul className="mt-2.5 space-y-1 text-xs text-[#252A34]">
                                  {bundle.products.slice(0, 2).map((item) => (
                                    <li key={item.id} className="flex items-center gap-1.5">
                                      <Check className="h-3 w-3 shrink-0 text-[#299B68]" />
                                      <span className="truncate">{item.name}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="mt-4 border-t border-[#E5E8F0] pt-3.5">
                                <div className="flex items-baseline justify-between">
                                  <span className="font-mono text-base font-bold tabular-nums text-[#252A34]">
                                    {formatInr(bundle.bundlePricePerDay)}
                                    <span className="font-sans text-xs font-normal text-[#646B7A]">
                                      {' '}
                                      / day
                                    </span>
                                  </span>
                                  <span className="text-[11px] font-medium text-[#299B68]">
                                    {freeBundleUnits} {freeBundleUnits === 1 ? 'kit' : 'kits'} ready
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  disabled={!bundle.available || freeBundleUnits <= 0}
                                  onClick={() => onSelectBundle(bundle)}
                                  className="mt-3 w-full min-h-[38px] rounded-lg border border-[#5478D5] bg-white px-3 py-2 text-xs font-semibold text-[#5478D5] transition-colors hover:bg-[#5478D5] hover:text-white disabled:opacity-50"
                                >
                                  {bundle.available ? 'Rent Entire Bundle' : 'Unavailable'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Individual Rental Products Grid */}
                {filteredProducts.length > 0 && (
                  <section>
                    {filteredBundles.length > 0 && (
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="font-display text-lg font-bold text-[#252A34]">
                          Rental Equipment ({filteredProducts.length})
                        </h2>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                      {filteredProducts.map((product) => {
                        const freeUnits = dateFilterActive
                          ? (availabilityMap?.availableUnitsByProductId[product.id] ?? 0)
                          : product.totalUnits;

                        return (
                          <div
                            key={product.id}
                            className="group flex flex-col overflow-hidden rounded-xl border border-[#E5E8F0] bg-white transition-shadow duration-200 hover:shadow-md"
                          >
                            <div className="relative">
                              <ProductImage
                                src={product.image}
                                alt={product.name}
                                categoryName={product.categoryName}
                                aspectClass="aspect-[4/3]"
                              />
                              <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-md border border-[#E5E8F0] bg-white/95 px-2 py-1 text-[11px] font-semibold text-[#252A34] backdrop-blur-xs">
                                <ShieldCheck className="h-3 w-3 text-[#299B68]" />
                                <span>{product.condition} Condition</span>
                              </span>
                            </div>

                            <div className="flex flex-1 flex-col justify-between p-4">
                              <div>
                                <h3 className="font-display line-clamp-2 text-[15px] leading-snug font-bold text-[#252A34]">
                                  {product.name}
                                </h3>
                                <p className="mt-1 flex items-center gap-1 text-xs text-[#646B7A]">
                                  <MapPin className="h-3 w-3 shrink-0 text-[#5478D5]" />
                                  <span className="truncate">
                                    {product.providerCity || 'Bengaluru'} ·{' '}
                                    {product.providerName || 'BorrowBox Hub'}
                                  </span>
                                </p>
                                <p className="mt-1.5 flex items-center justify-between text-[11px] text-[#646B7A]">
                                  <span>{product.categoryName}</span>
                                  <span
                                    className={`font-medium ${
                                      product.available && freeUnits > 0
                                        ? 'text-[#299B68]'
                                        : 'text-[#DC2626]'
                                    }`}
                                  >
                                    {product.available && freeUnits > 0
                                      ? `${freeUnits} ${dateFilterActive ? 'free' : 'units'}`
                                      : 'Unavailable'}
                                  </span>
                                </p>
                              </div>

                              <div className="mt-4 border-t border-[#E5E8F0] pt-3.5">
                                <div className="mb-3 flex items-baseline justify-between">
                                  <span className="font-mono text-base font-bold tabular-nums text-[#252A34]">
                                    {formatInr(product.pricePerDay)}
                                    <span className="font-sans text-xs font-normal text-[#646B7A]">
                                      {' '}
                                      / day
                                    </span>
                                  </span>
                                  <span className="font-mono text-[11px] text-[#646B7A]">
                                    {product.code}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => onSelectProduct(product)}
                                    className="min-h-[38px] rounded-lg border border-[#E5E8F0] bg-white px-2.5 py-2 text-xs font-semibold text-[#252A34] transition-colors hover:border-[#5478D5] hover:text-[#5478D5] whitespace-nowrap"
                                  >
                                    View Details
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!product.available || freeUnits <= 0}
                                    onClick={() =>
                                      onQuickAddProduct(
                                        product,
                                        dateFilterActive
                                          ? { startDate, endDate }
                                          : undefined,
                                      )
                                    }
                                    className="min-h-[38px] rounded-lg border border-[#5478D5] bg-[#5478D5] px-2.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#4365BE] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                                  >
                                    Add to Cart
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
