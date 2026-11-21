import { useState, useEffect } from 'react';
import { X, Calendar, CheckCircle2, AlertCircle, ShieldCheck, Minus, Plus, Store, MapPin } from 'lucide-react';
import type { Product } from '../types';
import {
  apiRequest,
  getTodayDateString,
  addDaysToDate,
  calculateRentalDays,
  formatInr,
} from '../lib/api';
import { ProductImage } from './ProductImage';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (payload: {
    productId: string;
    startDate: string;
    endDate: string;
    quantity: number;
  }) => Promise<void>;
}

interface AvailabilityState {
  checking: boolean;
  available: boolean;
  availableUnits: number;
  days: number;
  totalPrice: number;
  reason?: string;
}

export function ProductDetailModal({ product, onClose, onAddToCart }: ProductDetailModalProps) {
  const today = getTodayDateString();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDaysToDate(today, 2));
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityState>({
    checking: false,
    available: true,
    availableUnits: product?.totalUnits || 1,
    days: 3,
    totalPrice: (product?.pricePerDay || 0) * 3,
  });

  useEffect(() => {
    if (!product) return;
    const baseToday = getTodayDateString();
    setStartDate(baseToday);
    setEndDate(addDaysToDate(baseToday, 2));
    setQuantity(1);
    setErrorMsg(null);
  }, [product]);

  useEffect(() => {
    if (!product) return;
    const days = calculateRentalDays(startDate, endDate);
    if (!startDate || !endDate || startDate < today || endDate < startDate || days <= 0) {
      setAvailability({
        checking: false,
        available: false,
        availableUnits: 0,
        days: 0,
        totalPrice: 0,
        reason:
          startDate < today
            ? 'Start date cannot be in the past.'
            : 'End date must be on or after the start date.',
      });
      return;
    }

    let cancelled = false;
    setAvailability((prev) => ({ ...prev, checking: true }));
    apiRequest<{
      available: boolean;
      availableUnits: number;
      days: number;
      totalPrice: number;
      reason?: string;
    }>(`/api/products/${product.id}/check-availability`, {
      method: 'POST',
      body: { startDate, endDate, quantity },
    })
      .then((res) => {
        if (!cancelled) {
          setAvailability({
            checking: false,
            available: res.available,
            availableUnits: res.availableUnits,
            days: res.days,
            totalPrice: res.totalPrice,
            reason: res.reason,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAvailability({
            checking: false,
            available: false,
            availableUnits: 0,
            days,
            totalPrice: product.pricePerDay * days * quantity,
            reason: err instanceof Error ? err.message : 'Could not verify availability.',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [product, startDate, endDate, quantity, today]);

  if (!product) return null;

  const handleConfirmAdd = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await onAddToCart({
        productId: product.id,
        startDate,
        endDate,
        quantity,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to add item to cart.');
    } finally {
      setSubmitting(false);
    }
  };

  const conditionTone =
    product.condition === 'Mint'
      ? 'text-[#299B68]'
      : product.condition === 'Good'
        ? 'text-[#5478D5]'
        : product.condition === 'Fair'
          ? 'text-[#D97706]'
          : 'text-[#DC2626]';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#252A34]/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
    >
      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[#E5E8F0] bg-white shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E5E8F0] bg-white text-[#252A34] hover:bg-[#F6F7FB]"
          aria-label="Close product details"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid md:grid-cols-12">
          {/* Left Gallery & Condition Report */}
          <div className="border-b border-[#E5E8F0] bg-[#F6F7FB] p-6 md:col-span-6 md:border-r md:border-b-0">
            <div className="overflow-hidden rounded-xl border border-[#E5E8F0] bg-white">
              <ProductImage
                src={product.image}
                alt={product.name}
                categoryName={product.categoryName}
                aspectClass="aspect-[4/3]"
              />
            </div>

            {/* Pre-Rental Condition Report Box */}
            <div className="mt-5 rounded-xl border border-[#E5E8F0] bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#252A34]">
                  <ShieldCheck className="h-4 w-4 text-[#5478D5]" />
                  <span>Pre-Rental Condition Report</span>
                </div>
                <span className={`text-xs font-semibold ${conditionTone}`}>
                  Condition: {product.condition}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#646B7A]">
                {product.conditionNotes || 'Inspected and cleaned prior to dispatch.'}
              </p>
            </div>

            {/* Rental Provider Info Card */}
            <div className="mt-3 rounded-xl border border-[#E5E8F0] bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#252A34]">
                  <Store className="h-4 w-4 text-[#5478D5]" />
                  <span>{product.providerName || 'BorrowBox Verified Hub'}</span>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#646B7A]">
                  <MapPin className="h-3 w-3 text-[#5478D5]" />
                  <span>{product.providerCity || 'Bengaluru'}</span>
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#646B7A]">
                {product.providerBio ||
                  'Verified BorrowBox marketplace rental provider with inspected gear.'}
              </p>
            </div>
          </div>

          {/* Right Contiguous Purchase Module */}
          <div className="flex flex-col justify-between p-6 md:col-span-6 md:p-8">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#646B7A]">
                <span>{product.categoryName}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{product.code}</span>
              </div>

              <h2
                id="product-modal-title"
                className="font-display mt-2 text-2xl font-bold text-[#252A34]"
              >
                {product.name}
              </h2>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold tabular-nums text-[#252A34]">
                  {formatInr(product.pricePerDay)}
                </span>
                <span className="text-sm text-[#646B7A]">/ day</span>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-[#646B7A]">{product.description}</p>

              {/* Rental Dates & Quantity */}
              <div className="mt-6 space-y-4 border-t border-[#E5E8F0] pt-5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[#252A34]">
                      <Calendar className="h-3.5 w-3.5 text-[#5478D5]" />
                      <span>Start Date</span>
                    </label>
                    <input
                      type="date"
                      min={today}
                      value={startDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStartDate(val);
                        if (endDate < val) setEndDate(val);
                      }}
                      className="w-full rounded-lg border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 text-sm text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[#252A34]">
                      <Calendar className="h-3.5 w-3.5 text-[#5478D5]" />
                      <span>End Date</span>
                    </label>
                    <input
                      type="date"
                      min={startDate || today}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 text-sm text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#252A34]">Units Needed</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E8F0] text-[#252A34] hover:bg-[#F6F7FB]"
                      aria-label="Decrease units"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center font-mono text-sm font-semibold tabular-nums">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity((q) => Math.min(Math.max(1, availability.availableUnits), q + 1))
                      }
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E8F0] text-[#252A34] hover:bg-[#F6F7FB]"
                      aria-label="Increase units"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Live Availability & Formula Summary */}
                <div className="rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] p-4">
                  <div className="flex items-center justify-between text-xs text-[#646B7A]">
                    <span>
                      {formatInr(product.pricePerDay)} × {availability.days || 0} day(s) × {quantity}{' '}
                      unit(s)
                    </span>
                    <span className="font-mono text-base font-bold tabular-nums text-[#252A34]">
                      {formatInr(availability.totalPrice)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2 text-xs font-medium">
                    {availability.checking ? (
                      <span className="text-[#646B7A]">Checking date availability...</span>
                    ) : availability.available ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#299B68]" />
                        <span className="text-[#299B68]">
                          Available ({availability.availableUnits} of {product.totalUnits} units free)
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 shrink-0 text-[#DC2626]" />
                        <span className="text-[#DC2626]">
                          {availability.reason || 'Unavailable for selected dates'}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {errorMsg && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-[#DC2626]">
                    {errorMsg}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                disabled={!availability.available || availability.checking || submitting}
                onClick={handleConfirmAdd}
                className="flex-1 min-h-[44px] rounded-xl bg-[#5478D5] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#4365BE] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Adding to Cart...' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
