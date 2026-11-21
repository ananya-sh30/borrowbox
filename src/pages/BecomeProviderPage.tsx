import { useState, useEffect, type FormEvent } from 'react';
import { Store, CheckCircle2, Clock, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import type { AppRoute, User } from '../types';
import { apiRequest, formatDisplayDate } from '../lib/api';

interface BecomeProviderPageProps {
  user: User | null;
  onNavigate: (route: AppRoute) => void;
  onUserUpdated: (user: User) => void;
  onRefreshAuth: () => Promise<void>;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export function BecomeProviderPage({
  user,
  onNavigate,
  onUserUpdated,
  onRefreshAuth,
  onToast,
}: BecomeProviderPageProps) {
  const [businessName, setBusinessName] = useState(user?.providerProfile?.businessName || '');
  const [city, setCity] = useState(user?.providerProfile?.city || '');
  const [contactPhone, setContactPhone] = useState(
    user?.providerProfile?.contactPhone || user?.phone || '',
  );
  const [bio, setBio] = useState(user?.providerProfile?.bio || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      onRefreshAuth().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (user) {
      setBusinessName((prev) => prev || user.providerProfile?.businessName || '');
      setCity((prev) => prev || user.providerProfile?.city || '');
      setContactPhone((prev) => prev || user.providerProfile?.contactPhone || user.phone || '');
      setBio((prev) => prev || user.providerProfile?.bio || '');
    }
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-140px)] bg-[#F6F7FB] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-lg rounded-2xl border border-[#E5E8F0] bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#E9EDFF] text-[#5478D5]">
            <Store className="h-6 w-6" />
          </div>
          <h1 className="font-display mt-4 text-2xl font-bold text-[#252A34]">
            Become a BorrowBox Rental Provider
          </h1>
          <p className="mt-2 text-sm text-[#646B7A]">
            Sign in or create a BorrowBox account first to list your cameras, electronics, or event
            gear for rent.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="rounded-xl bg-[#5478D5] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4365BE]"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/signup')}
              className="rounded-xl border border-[#E5E8F0] bg-white px-5 py-2.5 text-sm font-semibold text-[#252A34] hover:bg-[#F6F7FB]"
            >
              Create Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (user.role === 'admin') {
    return (
      <div className="min-h-[calc(100vh-140px)] bg-[#F6F7FB] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-lg rounded-2xl border border-[#E5E8F0] bg-white p-8 text-center">
          <h1 className="font-display text-xl font-bold text-[#252A34]">Administrator Account</h1>
          <p className="mt-2 text-sm text-[#646B7A]">
            You are signed in as a platform administrator. Use the Admin Console to approve
            providers and listings.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/admin')}
            className="mt-5 rounded-xl bg-[#5478D5] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4365BE]"
          >
            Go to Admin Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (user.role === 'provider' && user.providerStatus === 'approved') {
    return (
      <div className="min-h-[calc(100vh-140px)] bg-[#F6F7FB] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-xl rounded-2xl border border-[#E5E8F0] bg-white p-8 shadow-xs">
          <div className="flex items-center gap-3 text-[#299B68]">
            <CheckCircle2 className="h-7 w-7 shrink-0" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide">Approved Partner</p>
              <h1 className="font-display text-2xl font-bold text-[#252A34]">
                You are a Verified Rental Provider
              </h1>
            </div>
          </div>

          <div className="mt-6 space-y-2 rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] p-4 text-sm">
            <p className="font-semibold text-[#252A34]">
              {user.providerProfile?.businessName || user.fullName}
            </p>
            <p className="text-xs text-[#646B7A]">
              Location: {user.providerProfile?.city || 'Campus Hub'} · Contact:{' '}
              {user.providerProfile?.contactPhone || user.phone}
            </p>
            <p className="text-xs leading-relaxed text-[#646B7A]">
              {user.providerProfile?.bio || 'Approved BorrowBox rental provider.'}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/provider')}
              className="inline-flex items-center gap-2 rounded-xl bg-[#5478D5] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4365BE]"
            >
              <span>Open Provider Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/products')}
              className="rounded-xl border border-[#E5E8F0] bg-white px-5 py-2.5 text-sm font-semibold text-[#252A34] hover:bg-[#F6F7FB]"
            >
              Browse &amp; Rent Gear
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleApply = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiRequest<{ user: User }>('/api/provider/apply', {
        method: 'POST',
        body: { businessName, city, contactPhone, bio },
      });
      if (res.user) {
        onUserUpdated(res.user);
      }
      onToast('Provider application submitted for admin review.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] bg-[#F6F7FB] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-[#E5E8F0] bg-white p-8 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E9EDFF] text-[#5478D5]">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-[#252A34]">
                Become a Rental Provider
              </h1>
              <p className="mt-1 text-sm text-[#646B7A]">
                List equipment you own, manage bookings &amp; returns, and keep your customer
                account to borrow from others anytime.
              </p>
            </div>
          </div>

          {user.providerStatus === 'pending' ? (
            <div className="mt-6 space-y-5">
              <div className="flex items-start gap-3 rounded-xl border border-[#E5E8F0] bg-[#E9EDFF]/50 p-4">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[#5478D5]" />
                <div>
                  <p className="text-sm font-semibold text-[#252A34]">
                    Application Pending Admin Approval
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#646B7A]">
                    Submitted on{' '}
                    {formatDisplayDate(user.providerProfile?.appliedAt || user.createdAt)}. Once a
                    BorrowBox administrator approves your application, your Provider Dashboard will
                    unlock automatically.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] p-4 text-xs">
                <p className="font-semibold text-[#252A34]">Submitted Provider Details</p>
                <p className="mt-2 text-[#646B7A]">
                  <span className="font-medium text-[#252A34]">Store Name:</span>{' '}
                  {user.providerProfile?.businessName}
                </p>
                <p className="mt-1 text-[#646B7A]">
                  <span className="font-medium text-[#252A34]">City / Hub:</span>{' '}
                  {user.providerProfile?.city}
                </p>
                <p className="mt-1 text-[#646B7A]">
                  <span className="font-medium text-[#252A34]">Contact:</span>{' '}
                  {user.providerProfile?.contactPhone}
                </p>
                <p className="mt-1 text-[#646B7A]">
                  <span className="font-medium text-[#252A34]">About:</span>{' '}
                  {user.providerProfile?.bio}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onRefreshAuth()}
                  className="rounded-xl bg-[#5478D5] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#4365BE]"
                >
                  Check Approval Status
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/products')}
                  className="rounded-xl border border-[#E5E8F0] bg-white px-4 py-2.5 text-xs font-semibold text-[#252A34] hover:bg-[#F6F7FB]"
                >
                  Continue Browsing Rentals
                </button>
              </div>
            </div>
          ) : (
            <>
              {user.providerStatus === 'rejected' && (
                <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-[#DC2626]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">Previous application was not approved</p>
                    {user.providerProfile?.reviewNote && (
                      <p className="mt-1">Note: {user.providerProfile.reviewNote}</p>
                    )}
                    <p className="mt-1">You can update your store details below and reapply.</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-[#DC2626]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleApply} className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#252A34]">
                      Provider / Store Name
                    </label>
                    <input
                      type="text"
                      required
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Campus Lens Studio"
                      className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 text-sm text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#252A34]">
                      City / Pickup Hub
                    </label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Bengaluru"
                      className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 text-sm text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#252A34]">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 text-sm text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#252A34]">
                    About Your Rentals &amp; Equipment
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Describe the gear you rent out, pickup/handover hours, and care standards..."
                    className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 text-sm text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="flex items-start gap-2.5 rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] p-3.5 text-xs text-[#646B7A]">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#5478D5]" />
                  <span>
                    All provider applications and submitted product listings are reviewed by a
                    BorrowBox administrator before going live to renters.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[44px] rounded-xl bg-[#5478D5] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4365BE] disabled:opacity-50"
                >
                  {submitting ? 'Submitting Application...' : 'Submit Provider Application'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
