import { useState, useEffect } from 'react';
import { X, Calendar, CheckCircle2, AlertCircle, Layers, ShieldCheck } from 'lucide-react';
import type { Bundle } from '../types';
import {
  apiRequest,
  getTodayDateString,
  addDaysToDate,
  calculateRentalDays,
  formatInr,
} from '../lib/api';
import { ProductImage } from './ProductImage';

interface BundleDetailModalProps {
  bundle: Bundle | null;
  onClose: () => void;
  onAddBundleToCart: (payload: {
    bundleId: string;
    startDate: string;
    endDate: string;
    quantity: number;
  }) => Promise<void>;
}

export function BundleDetailModal({
  bundle,
  onClose,
  onAddBundleToCart,
}: BundleDetailModalProps) {
  const today = getTodayDateString();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDaysToDate(today, 2));
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [availability, setAvailability] = useState<{
    checking: boolean;
    available: boolean;
    availableUnits: number;
    days: number;
    totalPrice: number;
    reason?: string;
  }>({
    checking: false,
    available: true,
    availableUnits: bundle?.availableUnits || 1,
    days: 3,
    totalPrice: (bundle?.bundlePricePerDay || 0) * 3,
  });

  useEffect(() => {
    if (!bundle) return;
    const baseToday = getTodayDateString();
    setStartDate(baseToday);
    setEndDate(addDaysToDate(baseToday, 2));
    setErrorMsg(null);
  }, [bundle]);

  useEffect(() => {
    if (!bundle) return;
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
            : 'End date must be on or after start date.',
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
    }>(`/api/bundles/${bundle.id}/check-availability`, {
      method: 'POST',
      body: { startDate, endDate, quantity: 1 },
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
            totalPrice: bundle.bundlePricePerDay * days,
            reason: err instanceof Error ? err.message : 'Availability check failed.',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bundle, startDate, endDate, today]);

  if (!bundle) return null;

  const handleRentBundle = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await onAddBundleToCart({
        bundleId: bundle.id,
        startDate,
        endDate,
        quantity: 1,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to add bundle to cart.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#252A34]/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bundle-modal-title"
    >
      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[#E5E8F0] bg-white shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E5E8F0] bg-white text-[#252A34] hover:bg-[#F6F7FB]"
          aria-label="Close bundle details"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid md:grid-cols-12">
          <div className="border-b border-[#E5E8F0] bg-[#F6F7FB] p-6 md:col-span-6 md:border-r md:border-b-0">
            <div className="overflow-hidden rounded-xl border border-[#E5E8F0] bg-white">
              <ProductImage
                src={bundle.image}
                alt={bundle.name}
                categoryName="Smart Rental Bundle"
                aspectClass="aspect-[4/3]"
              />
            </div>

            <div className="mt-5 rounded-xl border border-[#E5E8F0] bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#252A34]">
                <Layers className="h-4 w-4 text-[#5478D5]" />
                <span>Included Items ({bundle.products.length})</span>
              </div>
              <ul className="mt-3 divide-y divide-[#E5E8F0]">
                {bundle.products.map((prod) => (
                  <li key={prod.id} className="flex items-center justify-between py-2.5 text-xs">
                    <div>
                      <p className="font-medium text-[#252A34]">{prod.name}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[#646B7A]">
                        <ShieldCheck className="h-3.5 w-3.5 text-[#299B68]" />
                        <span>Condition: {prod.condition}</span>
                      </p>
                    </div>
                    <span className="font-mono text-[#646B7A] tabular-nums">
                      {formatInr(prod.pricePerDay)}/day solo
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col justify-between p-6 md:col-span-6 md:p-8">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#646B7A]">
                <span>Smart Rental Bundle</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{bundle.code}</span>
              </div>

              <h2
                id="bundle-modal-title"
                className="font-display mt-2 text-2xl font-bold text-[#252A34]"
              >
                {bundle.name}
              </h2>

              <div className="mt-3 flex items-baseline gap-3">
                <span className="font-mono text-2xl font-bold tabular-nums text-[#252A34]">
                  {formatInr(bundle.bundlePricePerDay)}
                </span>
                <span className="text-sm text-[#646B7A]">/ day</span>
                {bundle.savingsPerDay > 0 && (
                  <span className="text-xs font-medium text-[#299B68]">
                    Save {formatInr(bundle.savingsPerDay)}/day vs individual
                  </span>
                )}
              </div>

              <p className="mt-4 text-sm leading-relaxed text-[#646B7A]">{bundle.description}</p>

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

                <div className="rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] p-4">
                  <div className="flex items-center justify-between text-xs text-[#646B7A]">
                    <span>
                      {formatInr(bundle.bundlePricePerDay)} × {availability.days || 0} day(s)
                    </span>
                    <span className="font-mono text-base font-bold tabular-nums text-[#252A34]">
                      {formatInr(availability.totalPrice)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2 text-xs font-medium">
                    {availability.checking ? (
                      <span className="text-[#646B7A]">Checking kit availability...</span>
                    ) : availability.available ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#299B68]" />
                        <span className="text-[#299B68]">
                          Complete kit available ({availability.availableUnits} set(s) free)
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 shrink-0 text-[#DC2626]" />
                        <span className="text-[#DC2626]">
                          {availability.reason || 'Bundle unavailable for selected dates'}
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

            <div className="mt-6">
              <button
                type="button"
                disabled={!availability.available || availability.checking || submitting}
                onClick={handleRentBundle}
                className="w-full min-h-[44px] rounded-xl bg-[#5478D5] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#4365BE] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Adding Bundle...' : 'Rent Entire Bundle'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
