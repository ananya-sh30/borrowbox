import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import {
  ShoppingBag,
  Trash2,
  CheckCircle2,
  ArrowRight,
  Package,
  Camera,
  X,
  Upload,
  Minus,
  Plus,
} from 'lucide-react';
import type {
  AppRoute,
  CartSummary,
  ConditionReport,
  Order,
  ReturnReportedCondition,
  User,
} from '../types';
import {
  apiRequest,
  formatDisplayDate,
  formatInr,
  getTodayDateString,
} from '../lib/api';
import { ProductImage } from '../components/ProductImage';

interface CartOrdersPageProps {
  activeTab: 'cart' | 'orders';
  onTabChange: (tab: 'cart' | 'orders') => void;
  user: User | null;
  cart: CartSummary;
  onRefreshCart: () => Promise<void>;
  onNavigate: (route: AppRoute) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export function CartOrdersPage({
  activeTab,
  onTabChange,
  user,
  cart,
  onRefreshCart,
  onNavigate,
  onToast,
}: CartOrdersPageProps) {
  const today = getTodayDateString();
  const [checkoutMode, setCheckoutMode] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(
    user?.email && !user.email.endsWith('@phone.borrowbox.local') ? user.email : '',
  );
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'demo_online'>('cod');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [reports, setReports] = useState<ConditionReport[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Return Condition Report modal state
  const [reportTarget, setReportTarget] = useState<{
    order: Order;
    productId: string;
    productName: string;
  } | null>(null);
  const [reportedCondition, setReportedCondition] = useState<ReturnReportedCondition>('Good');
  const [customerNotes, setCustomerNotes] = useState('');
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName((prev) => prev || user.fullName);
      if (!user.email.endsWith('@phone.borrowbox.local')) {
        setEmail((prev) => prev || user.email);
      }
      if (user.phone) setPhone((prev) => prev || user.phone);
    }
  }, [user]);

  const fetchMyOrders = async () => {
    if (!user) {
      setOrders([]);
      setReports([]);
      return;
    }
    setLoadingOrders(true);
    try {
      const data = await apiRequest<{ orders: Order[]; conditionReports: ConditionReport[] }>(
        '/api/orders/my',
      );
      setOrders(data.orders || []);
      setReports(data.conditionReports || []);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to load orders.', 'error');
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'orders' && user) {
      fetchMyOrders();
    }
  }, [activeTab, user]);

  const handleUpdateCartItem = async (
    itemId: string,
    patch: { startDate?: string; endDate?: string; quantity?: number },
  ) => {
    try {
      await apiRequest(`/api/cart/${itemId}`, { method: 'PATCH', body: patch });
      await onRefreshCart();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not update rental item.', 'error');
    }
  };

  const handleRemoveCartItem = async (itemId: string) => {
    try {
      await apiRequest(`/api/cart/${itemId}`, { method: 'DELETE' });
      await onRefreshCart();
      onToast('Removed item from cart.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to remove item.', 'error');
    }
  };

  const handlePlaceOrder = async (e: FormEvent) => {
    e.preventDefault();
    setCheckoutError(null);

    if (!user) {
      onNavigate('/login');
      return;
    }

    if (fullName.trim().length < 2) {
      setCheckoutError('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setCheckoutError('Please enter a valid email address.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 7) {
      setCheckoutError('Please enter a valid phone number.');
      return;
    }
    if (address.trim().length < 8 || city.trim().length < 2) {
      setCheckoutError('Please enter your complete street address and city.');
      return;
    }
    if (!/^\d{5,6}$/.test(pinCode.trim())) {
      setCheckoutError('Please enter a valid 5 or 6 digit PIN code.');
      return;
    }

    setPlacingOrder(true);
    try {
      const res = await apiRequest<{ order: Order }>('/api/orders', {
        method: 'POST',
        body: {
          fullName,
          email,
          phone,
          address,
          city,
          pinCode,
          paymentMethod,
        },
      });
      setConfirmedOrder(res.order);
      setCheckoutMode(false);
      await onRefreshCart();
      onToast(`Order ${res.order.orderNumber} placed successfully.`);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Order could not be placed.');
    } finally {
      setPlacingOrder(false);
    }
  };

  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remaining = 4 - uploadedPhotos.length;
    const selected = files.slice(0, remaining);

    for (const file of selected) {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        onToast('Only PNG, JPEG, or WebP images are supported.', 'error');
        continue;
      }
      if (file.size > 1_800_000) {
        onToast(`${file.name} exceeds 1.8MB limit.`, 'error');
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setUploadedPhotos((prev) => (prev.length < 4 ? [...prev, reader.result as string] : prev));
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleSubmitConditionReport = async (e: FormEvent) => {
    e.preventDefault();
    if (!reportTarget) return;
    if (customerNotes.trim().length < 5) {
      onToast('Please enter at least 5 characters describing the return condition.', 'error');
      return;
    }

    setSubmittingReport(true);
    try {
      await apiRequest('/api/condition-reports', {
        method: 'POST',
        body: {
          orderId: reportTarget.order.id,
          productId: reportTarget.productId,
          reportedCondition,
          customerNotes,
          photos: uploadedPhotos,
        },
      });
      onToast('Return condition report submitted for admin inspection.');
      setReportTarget(null);
      setCustomerNotes('');
      setUploadedPhotos([]);
      setReportedCondition('Good');
      await fetchMyOrders();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not submit condition report.', 'error');
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="bg-white py-10">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        {/* Top Tab Navigation */}
        <div className="flex flex-col justify-between gap-4 border-b border-[#E5E8F0] pb-6 sm:flex-row sm:items-center">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-[#252A34]">
              {activeTab === 'cart' ? 'Rental Cart & Checkout' : 'My Rental Orders'}
            </h1>
            <p className="mt-1 text-sm text-[#646B7A]">
              {activeTab === 'cart'
                ? 'Adjust rental dates, verify totals, and complete your booking.'
                : 'Track rental status and submit return condition photos.'}
            </p>
          </div>

          <div className="inline-flex rounded-xl bg-[#F6F7FB] p-1">
            <button
              type="button"
              onClick={() => {
                setConfirmedOrder(null);
                onTabChange('cart');
              }}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'cart'
                  ? 'bg-white text-[#252A34] shadow-xs'
                  : 'text-[#646B7A] hover:text-[#252A34]'
              }`}
            >
              Shopping Cart ({cart.items.reduce((s, i) => s + i.quantity, 0)})
            </button>
            <button
              type="button"
              onClick={() => onTabChange('orders')}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'orders'
                  ? 'bg-white text-[#252A34] shadow-xs'
                  : 'text-[#646B7A] hover:text-[#252A34]'
              }`}
            >
              My Orders
            </button>
          </div>
        </div>

        {/* TAB 1: SHOPPING CART & CHECKOUT */}
        {activeTab === 'cart' && (
          <div className="mt-8">
            {confirmedOrder ? (
              <div className="mx-auto max-w-2xl rounded-2xl border border-[#E5E8F0] bg-[#F6F7FB] p-8">
                <div className="flex items-center gap-3 text-[#299B68]">
                  <CheckCircle2 className="h-7 w-7 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide">
                      Booking Confirmed
                    </p>
                    <h2 className="font-display text-2xl font-bold text-[#252A34]">
                      Order {confirmedOrder.orderNumber} Placed
                    </h2>
                  </div>
                </div>

                <div className="mt-6 space-y-3 rounded-xl border border-[#E5E8F0] bg-white p-5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#646B7A]">Payment Method</span>
                    <span className="font-medium text-[#252A34]">
                      {confirmedOrder.paymentMethod === 'demo_online'
                        ? 'Demo Online Payment (Simulated)'
                        : 'Cash on Delivery'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#646B7A]">Payment Status</span>
                    <span className="font-medium text-[#299B68]">{confirmedOrder.paymentStatus}</span>
                  </div>
                  {confirmedOrder.transactionRef && (
                    <div className="flex justify-between">
                      <span className="text-[#646B7A]">Demo Transaction Ref</span>
                      <span className="font-mono text-xs font-semibold text-[#252A34]">
                        {confirmedOrder.transactionRef}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-[#E5E8F0] pt-3">
                    <span className="font-semibold text-[#252A34]">Total Amount</span>
                    <span className="font-mono text-base font-bold tabular-nums text-[#252A34]">
                      {formatInr(confirmedOrder.totalAmount)}
                    </span>
                  </div>
                </div>

                <p className="mt-4 text-xs text-[#646B7A]">
                  {confirmedOrder.paymentMethod === 'demo_online'
                    ? 'Academic demonstration notice: No real financial charge was processed.'
                    : 'Pay in cash when your rental items are delivered or picked up.'}
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmedOrder(null);
                      onTabChange('orders');
                    }}
                    className="rounded-xl bg-[#5478D5] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4365BE]"
                  >
                    View My Orders
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmedOrder(null);
                      onNavigate('/products');
                    }}
                    className="rounded-xl border border-[#E5E8F0] bg-white px-5 py-2.5 text-sm font-semibold text-[#252A34] hover:bg-[#F6F7FB]"
                  >
                    Continue Shopping
                  </button>
                </div>
              </div>
            ) : cart.items.length === 0 ? (
              <div className="rounded-2xl border border-[#E5E8F0] bg-[#F6F7FB] px-6 py-16 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[#E5E8F0] bg-white text-[#5478D5]">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <h2 className="font-display mt-4 text-xl font-semibold text-[#252A34]">
                  Your rental cart is empty
                </h2>
                <p className="mt-1.5 text-sm text-[#646B7A]">
                  Explore cameras, projectors, calculators, or ready-made rental bundles to start.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('/products')}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#5478D5] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4365BE]"
                >
                  <span>Explore Rentals</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="grid gap-8 lg:grid-cols-12">
                {/* Left Column: Cart Items OR Checkout Form */}
                <div className="lg:col-span-8">
                  {!checkoutMode ? (
                    <div className="space-y-4">
                      {cart.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col gap-4 rounded-2xl border border-[#E5E8F0] bg-white p-4 sm:flex-row sm:items-center sm:p-5"
                        >
                          <div className="w-full shrink-0 overflow-hidden rounded-xl border border-[#E5E8F0] sm:w-36">
                            <ProductImage
                              src={item.productImage}
                              alt={item.productName}
                              categoryName={item.categoryName}
                              aspectClass="aspect-[4/3]"
                            />
                          </div>

                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs text-[#646B7A]">
                                  {item.categoryName} ·{' '}
                                  <span className="font-mono">{item.productCode}</span>
                                </p>
                                <h3 className="font-display mt-0.5 text-base font-semibold text-[#252A34]">
                                  {item.productName}
                                </h3>
                                {item.isBundle && item.includedProductNames && (
                                  <p className="mt-0.5 text-xs text-[#5478D5]">
                                    Includes: {item.includedProductNames.join(' + ')}
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveCartItem(item.id)}
                                className="rounded-lg p-2 text-[#646B7A] hover:bg-red-50 hover:text-[#DC2626]"
                                aria-label={`Remove ${item.productName}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="mt-3 grid gap-3 sm:grid-cols-3">
                              <div>
                                <label className="block text-[11px] font-medium text-[#646B7A]">
                                  Start Date
                                </label>
                                <input
                                  type="date"
                                  min={today}
                                  value={item.startDate}
                                  onChange={(e) => {
                                    const nextStart = e.target.value;
                                    handleUpdateCartItem(item.id, {
                                      startDate: nextStart,
                                      endDate: item.endDate < nextStart ? nextStart : item.endDate,
                                    });
                                  }}
                                  className="mt-1 w-full rounded-lg border border-[#E5E8F0] bg-[#F6F7FB] px-2.5 py-1.5 text-xs text-[#252A34]"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-[#646B7A]">
                                  End Date
                                </label>
                                <input
                                  type="date"
                                  min={item.startDate || today}
                                  value={item.endDate}
                                  onChange={(e) =>
                                    handleUpdateCartItem(item.id, { endDate: e.target.value })
                                  }
                                  className="mt-1 w-full rounded-lg border border-[#E5E8F0] bg-[#F6F7FB] px-2.5 py-1.5 text-xs text-[#252A34]"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-[#646B7A]">
                                  Units
                                </label>
                                <div className="mt-1 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateCartItem(item.id, {
                                        quantity: Math.max(1, item.quantity - 1),
                                      })
                                    }
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E8F0] text-[#252A34] hover:bg-[#F6F7FB]"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <span className="w-6 text-center font-mono text-xs font-semibold tabular-nums">
                                    {item.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateCartItem(item.id, {
                                        quantity: Math.min(item.totalUnits, item.quantity + 1),
                                      })
                                    }
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E8F0] text-[#252A34] hover:bg-[#F6F7FB]"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E8F0] pt-3 text-xs">
                              <span className="text-[#646B7A]">
                                {formatInr(item.pricePerDay)}/day × {item.days} day(s) ×{' '}
                                {item.quantity}
                              </span>
                              <span className="font-mono text-sm font-bold tabular-nums text-[#252A34]">
                                {formatInr(item.lineTotal)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <form
                      onSubmit={handlePlaceOrder}
                      className="rounded-2xl border border-[#E5E8F0] bg-white p-6"
                    >
                      <div className="flex items-center justify-between border-b border-[#E5E8F0] pb-4">
                        <h2 className="font-display text-xl font-bold text-[#252A34]">
                          Checkout Details
                        </h2>
                        <button
                          type="button"
                          onClick={() => setCheckoutMode(false)}
                          className="text-xs font-semibold text-[#5478D5] hover:underline"
                        >
                          Back to Cart
                        </button>
                      </div>

                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-[#252A34]">
                            Full Name
                          </label>
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 text-sm text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#252A34]">
                            Email Address
                          </label>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 text-sm text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#252A34]">
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+91 98765 43210"
                            className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 text-sm text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-[#252A34]">
                            Complete Address
                          </label>
                          <textarea
                            rows={2}
                            required
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Hostel block / Street address, apartment, landmark"
                            className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 text-sm text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#252A34]">
                            City
                          </label>
                          <input
                            type="text"
                            required
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 text-sm text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#252A34]">
                            PIN Code
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={6}
                            value={pinCode}
                            onChange={(e) => setPinCode(e.target.value)}
                            placeholder="560001"
                            className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 font-mono text-sm text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Payment Method */}
                      <div className="mt-6 border-t border-[#E5E8F0] pt-5">
                        <p className="text-xs font-semibold text-[#252A34]">
                          Payment Method (Academic Demo)
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <label
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                              paymentMethod === 'cod'
                                ? 'border-[#5478D5] bg-[#E9EDFF]/40'
                                : 'border-[#E5E8F0] bg-white'
                            }`}
                          >
                            <input
                              type="radio"
                              name="paymentMethod"
                              checked={paymentMethod === 'cod'}
                              onChange={() => setPaymentMethod('cod')}
                              className="mt-1 accent-[#5478D5]"
                            />
                            <div>
                              <p className="text-sm font-semibold text-[#252A34]">
                                Cash on Delivery
                              </p>
                              <p className="text-xs text-[#646B7A]">
                                Pay on equipment handover or pickup.
                              </p>
                            </div>
                          </label>

                          <label
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                              paymentMethod === 'demo_online'
                                ? 'border-[#5478D5] bg-[#E9EDFF]/40'
                                : 'border-[#E5E8F0] bg-white'
                            }`}
                          >
                            <input
                              type="radio"
                              name="paymentMethod"
                              checked={paymentMethod === 'demo_online'}
                              onChange={() => setPaymentMethod('demo_online')}
                              className="mt-1 accent-[#5478D5]"
                            />
                            <div>
                              <p className="text-sm font-semibold text-[#252A34]">
                                Demo Online Payment
                              </p>
                              <p className="text-xs text-[#646B7A]">
                                Simulated checkout with instant reference ID. No card required.
                              </p>
                            </div>
                          </label>
                        </div>
                      </div>

                      {checkoutError && (
                        <p className="mt-4 rounded-lg bg-red-50 px-3.5 py-2.5 text-xs font-medium text-[#DC2626]">
                          {checkoutError}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={placingOrder}
                        className="mt-6 w-full min-h-[44px] rounded-xl bg-[#5478D5] px-6 py-3 text-sm font-semibold text-white hover:bg-[#4365BE] disabled:opacity-50"
                      >
                        {placingOrder
                          ? 'Placing Order...'
                          : `Confirm Rental Order (${formatInr(cart.totalAmount)})`}
                      </button>
                    </form>
                  )}
                </div>

                {/* Right Column: Order Summary */}
                <div className="lg:col-span-4">
                  <div className="sticky top-24 rounded-2xl border border-[#E5E8F0] bg-[#F6F7FB] p-6">
                    <h2 className="font-display text-lg font-bold text-[#252A34]">
                      Rental Summary
                    </h2>
                    <div className="mt-4 space-y-3 border-b border-[#E5E8F0] pb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#646B7A]">Rental Subtotal</span>
                        <span className="font-mono font-medium tabular-nums text-[#252A34]">
                          {formatInr(cart.subtotal)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#646B7A]">Handling &amp; Delivery</span>
                        <span className="font-mono font-medium tabular-nums text-[#252A34]">
                          {cart.deliveryFee === 0 ? 'Free' : formatInr(cart.deliveryFee)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#646B7A]">
                        Free delivery on rental orders above ₹1,000.
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#252A34]">Final Total</span>
                      <span className="font-mono text-xl font-bold tabular-nums text-[#252A34]">
                        {formatInr(cart.totalAmount)}
                      </span>
                    </div>

                    {!checkoutMode && (
                      <div className="mt-6">
                        {user ? (
                          <button
                            type="button"
                            onClick={() => setCheckoutMode(true)}
                            className="w-full min-h-[44px] rounded-xl bg-[#5478D5] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#4365BE]"
                          >
                            Proceed to Checkout
                          </button>
                        ) : (
                          <div className="space-y-2.5">
                            <p className="text-xs text-[#646B7A]">
                              Sign in to your BorrowBox customer account to place this rental order.
                            </p>
                            <button
                              type="button"
                              onClick={() => onNavigate('/login')}
                              className="w-full min-h-[44px] rounded-xl bg-[#5478D5] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#4365BE]"
                            >
                              Login to Checkout
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MY ORDERS & RETURN CONDITION REPORTS */}
        {activeTab === 'orders' && (
          <div className="mt-8">
            {!user ? (
              <div className="rounded-2xl border border-[#E5E8F0] bg-[#F6F7FB] px-6 py-16 text-center">
                <Package className="mx-auto h-10 w-10 text-[#5478D5]" />
                <h2 className="font-display mt-3 text-xl font-semibold text-[#252A34]">
                  Sign in to view your orders
                </h2>
                <p className="mt-1.5 text-sm text-[#646B7A]">
                  Your rental bookings and return condition reports are securely tied to your
                  account.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('/login')}
                  className="mt-5 rounded-xl bg-[#5478D5] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4365BE]"
                >
                  Login to Account
                </button>
              </div>
            ) : loadingOrders ? (
              <div className="space-y-4">
                {[1, 2].map((n) => (
                  <div
                    key={n}
                    className="h-36 animate-pulse rounded-2xl border border-[#E5E8F0] bg-[#F6F7FB]"
                  />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="rounded-2xl border border-[#E5E8F0] bg-[#F6F7FB] px-6 py-16 text-center">
                <Package className="mx-auto h-10 w-10 text-[#5478D5]" />
                <h2 className="font-display mt-3 text-xl font-semibold text-[#252A34]">
                  No rental orders yet
                </h2>
                <p className="mt-1.5 text-sm text-[#646B7A]">
                  Once you place a booking, you can track its status and submit return photos here.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('/products')}
                  className="mt-5 rounded-xl bg-[#5478D5] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4365BE]"
                >
                  Browse Equipment
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="overflow-hidden rounded-2xl border border-[#E5E8F0] bg-white"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E8F0] bg-[#F6F7FB] px-5 py-4 text-xs">
                      <div className="flex flex-wrap items-center gap-4">
                        <div>
                          <span className="text-[#646B7A]">Order ID </span>
                          <span className="font-mono font-bold text-[#252A34]">
                            {order.orderNumber}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#646B7A]">Booked </span>
                          <span className="font-medium text-[#252A34]">
                            {formatDisplayDate(order.createdAt)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#646B7A]">Payment </span>
                          <span className="font-medium text-[#252A34]">{order.paymentStatus}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span
                          className={`font-semibold ${
                            order.orderStatus === 'Cancelled'
                              ? 'text-[#DC2626]'
                              : order.orderStatus === 'Returned'
                                ? 'text-[#299B68]'
                                : 'text-[#5478D5]'
                          }`}
                        >
                          Status: {order.orderStatus}
                        </span>
                        <span className="font-mono text-sm font-bold tabular-nums text-[#252A34]">
                          {formatInr(order.totalAmount)}
                        </span>
                      </div>
                    </div>

                    <div className="divide-y divide-[#E5E8F0] px-5">
                      {order.items.map((item, idx) => {
                        const targetProductId =
                          item.includedProductIds && item.includedProductIds.length > 0
                            ? item.includedProductIds[0]
                            : item.productId;
                        const existingReport = reports.find(
                          (r) =>
                            r.orderId === order.id &&
                            (r.productId === targetProductId ||
                              item.includedProductIds?.includes(r.productId)),
                        );

                        return (
                          <div
                            key={`${order.id}-${idx}`}
                            className="flex flex-col justify-between gap-4 py-4 sm:flex-row sm:items-center"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-24 shrink-0 overflow-hidden rounded-xl border border-[#E5E8F0]">
                                <ProductImage
                                  src={item.productImage}
                                  alt={item.productName}
                                  categoryName={item.categoryName}
                                  aspectClass="aspect-[4/3]"
                                />
                              </div>
                              <div>
                                <p className="font-display text-sm font-semibold text-[#252A34]">
                                  {item.productName}
                                </p>
                                {item.providerName && (
                                  <p className="mt-0.5 text-xs text-[#646B7A]">
                                    Provider: <span className="font-medium text-[#252A34]">{item.providerName}</span>
                                    {item.itemStatus ? ` · ${item.itemStatus}` : ''}
                                  </p>
                                )}
                                {item.includedProductNames && (
                                  <p className="mt-0.5 text-xs text-[#5478D5]">
                                    Bundle items: {item.includedProductNames.join(', ')}
                                  </p>
                                )}
                                <p className="mt-1 text-xs text-[#646B7A]">
                                  {formatDisplayDate(item.startDate)} →{' '}
                                  {formatDisplayDate(item.endDate)} ({item.days} days ×{' '}
                                  {item.quantity} unit)
                                </p>
                                <p className="mt-1 font-mono text-xs font-semibold tabular-nums text-[#252A34]">
                                  {formatInr(item.lineTotal)}
                                </p>
                              </div>
                            </div>

                            {/* Return Condition Report Action */}
                            <div className="flex flex-col items-start gap-2 sm:items-end">
                              {existingReport ? (
                                <div className="rounded-lg border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 text-xs">
                                  <p className="font-semibold text-[#252A34]">
                                    Return Report: {existingReport.reportedCondition}
                                  </p>
                                  <p className="text-[#646B7A]">
                                    Review: {existingReport.adminStatus}
                                  </p>
                                </div>
                              ) : (
                                order.orderStatus !== 'Cancelled' && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setReportTarget({
                                        order,
                                        productId: targetProductId,
                                        productName: item.productName,
                                      })
                                    }
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E8F0] bg-white px-3.5 py-2 text-xs font-semibold text-[#5478D5] hover:bg-[#E9EDFF]/50"
                                  >
                                    <Camera className="h-3.5 w-3.5" />
                                    <span>Submit Return Condition Report</span>
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Return Condition Report Modal */}
      {reportTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#252A34]/40 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E5E8F0] bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setReportTarget(null)}
              className="absolute top-4 right-4 rounded-lg p-2 text-[#646B7A] hover:bg-[#F6F7FB]"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="font-display text-xl font-bold text-[#252A34]">
              Return Condition Report
            </h3>
            <p className="mt-1 text-xs text-[#646B7A]">
              Order <span className="font-mono font-semibold">{reportTarget.order.orderNumber}</span>{' '}
              · {reportTarget.productName}
            </p>

            <form onSubmit={handleSubmitConditionReport} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#252A34]">
                  Item Condition on Return
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Mint', 'Good', 'Fair', 'Damaged'] as ReturnReportedCondition[]).map(
                    (cond) => (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => setReportedCondition(cond)}
                        className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                          reportedCondition === cond
                            ? 'border-[#5478D5] bg-[#E9EDFF] text-[#5478D5]'
                            : 'border-[#E5E8F0] bg-white text-[#646B7A] hover:text-[#252A34]'
                        }`}
                      >
                        {cond}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#252A34]">
                  Condition Notes
                </label>
                <textarea
                  rows={3}
                  required
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Describe item functionality, included accessories, or any wear/issues noticed..."
                  className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 text-sm text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#252A34]">
                  Upload Return Photos (up to 4 images)
                </label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#5478D5]/50 bg-[#F6F7FB] px-4 py-4 text-xs font-medium text-[#5478D5] hover:bg-[#E9EDFF]/50">
                  <Upload className="h-4 w-4" />
                  <span>Select PNG, JPG, or WebP photos</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>

                {uploadedPhotos.length > 0 && (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {uploadedPhotos.map((src, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-square overflow-hidden rounded-lg border border-[#E5E8F0]"
                      >
                        <img
                          src={src}
                          alt={`Return photo ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setUploadedPhotos((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="absolute top-1 right-1 rounded-full bg-white/90 p-0.5 text-[#252A34] shadow-xs"
                          aria-label="Remove photo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submittingReport}
                className="w-full min-h-[44px] rounded-xl bg-[#5478D5] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4365BE] disabled:opacity-50"
              >
                {submittingReport ? 'Submitting Report...' : 'Submit Condition Report'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
