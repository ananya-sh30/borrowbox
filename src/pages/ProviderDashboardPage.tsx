import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  ShieldAlert,
  Store,
  Plus,
  Pencil,
  Trash2,
  X,
  Upload,
  ShoppingBag,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import type {
  AppRoute,
  Category,
  ConditionReport,
  Order,
  OrderStatus,
  Product,
  ProductCondition,
  ProviderOverview,
  ReportReviewStatus,
  User,
} from '../types';
import { apiRequest, formatDisplayDate, formatInr } from '../lib/api';
import { ProductImage } from '../components/ProductImage';

interface ProviderDashboardPageProps {
  user: User | null;
  onNavigate: (route: AppRoute) => void;
  onUserUpdated: (user: User) => void;
  onLogout: () => Promise<void>;
  onDataUpdated: () => Promise<void>;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

type ProviderSection = 'overview' | 'listings' | 'bookings' | 'reports' | 'profile';

const IMAGE_PRESETS = [
  {
    label: 'DSLR Camera',
    path: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Canon_EOS_7D_DSLR_body_front.jpg/960px-Canon_EOS_7D_DSLR_body_front.jpg',
  },
  {
    label: 'HD Projector',
    path: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/BenQ_DLP_projector_MP515_20101213.jpg/960px-BenQ_DLP_projector_MP515_20101213.jpg',
  },
  {
    label: 'Camping Tent',
    path: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e2/Camping_in_the_mountains_%28Unsplash%29.jpg/960px-Camping_in_the_mountains_%28Unsplash%29.jpg',
  },
  {
    label: 'Sports Kit',
    path: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ad/Rachet%C4%83_de_badminton_%C5%9Fi_flutura%C5%9F.jpg/960px-Rachet%C4%83_de_badminton_%C5%9Fi_flutura%C5%9F.jpg',
  },
];

export function ProviderDashboardPage({
  user,
  onNavigate,
  onUserUpdated,
  onLogout,
  onDataUpdated,
  onToast,
}: ProviderDashboardPageProps) {
  const [section, setSection] = useState<ProviderSection>('overview');
  const [overview, setOverview] = useState<ProviderOverview | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reports, setReports] = useState<ConditionReport[]>([]);
  const [loading, setLoading] = useState(true);

  // Add/Edit Listing Modal
  const [listingModalOpen, setListingModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodForm, setProdForm] = useState({
    name: '',
    code: '',
    description: '',
    categoryId: '',
    pricePerDay: '250',
    image: IMAGE_PRESETS[0].path,
    totalUnits: '1',
    available: true,
    condition: 'Mint' as ProductCondition,
    conditionNotes: 'Inspected and ready for rental.',
  });

  // Quick Condition Update Modal
  const [conditionTarget, setConditionTarget] = useState<Product | null>(null);
  const [conditionForm, setConditionForm] = useState({
    condition: 'Good' as ProductCondition,
    conditionNotes: '',
    available: true,
  });

  // Report Review Modal
  const [reviewingReport, setReviewingReport] = useState<ConditionReport | null>(null);
  const [reviewForm, setReviewForm] = useState({
    adminStatus: 'Reviewed - Cleared' as ReportReviewStatus,
    damageDetected: false,
    adminNotes: '',
    updateProductConditionTo: 'Good' as ProductCondition,
    updateProductConditionNotes: '',
    setProductAvailable: true,
  });

  // Profile Settings Form
  const [profileForm, setProfileForm] = useState({
    businessName: user?.providerProfile?.businessName || '',
    city: user?.providerProfile?.city || '',
    contactPhone: user?.providerProfile?.contactPhone || user?.phone || '',
    bio: user?.providerProfile?.bio || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const loadProviderData = async () => {
    setLoading(true);
    try {
      const [ov, pr, ct, ord, rep] = await Promise.all([
        apiRequest<ProviderOverview>('/api/provider/overview'),
        apiRequest<{ products: Product[] }>('/api/provider/products'),
        apiRequest<{ categories: Category[] }>('/api/categories'),
        apiRequest<{ orders: Order[] }>('/api/provider/orders'),
        apiRequest<{ reports: ConditionReport[] }>('/api/provider/condition-reports'),
      ]);
      setOverview(ov);
      setProducts(pr.products);
      setCategories(ct.categories);
      setOrders(ord.orders);
      setReports(rep.reports);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to load provider dashboard.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      onNavigate('/login');
      return;
    }
    if (user.role !== 'provider' && user.role !== 'admin') {
      onNavigate('/become-provider');
      return;
    }
    setProfileForm({
      businessName: user.providerProfile?.businessName || user.fullName,
      city: user.providerProfile?.city || '',
      contactPhone: user.providerProfile?.contactPhone || user.phone || '',
      bio: user.providerProfile?.bio || '',
    });
    loadProviderData();
  }, [user]);

  if (!user || (user.role !== 'provider' && user.role !== 'admin')) {
    return null;
  }

  const openNewListing = () => {
    setEditingProduct(null);
    setProdForm({
      name: '',
      code: `BB-PRV-${Math.floor(100 + Math.random() * 899)}`,
      description: '',
      categoryId: categories[0]?.id || '',
      pricePerDay: '250',
      image: IMAGE_PRESETS[0].path,
      totalUnits: '1',
      available: true,
      condition: 'Mint',
      conditionNotes: 'Inspected and ready for rental.',
    });
    setListingModalOpen(true);
  };

  const openEditListing = (p: Product) => {
    setEditingProduct(p);
    setProdForm({
      name: p.name,
      code: p.code,
      description: p.description,
      categoryId: p.categoryId,
      pricePerDay: String(p.pricePerDay),
      image: p.image,
      totalUnits: String(p.totalUnits),
      available: p.available,
      condition: p.condition,
      conditionNotes: p.conditionNotes,
    });
    setListingModalOpen(true);
  };

  const handleImageFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      onToast('Only PNG, JPEG, or WebP images are supported.', 'error');
      return;
    }
    if (file.size > 1_800_000) {
      onToast('Image file must be under 1.8MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProdForm((prev) => ({ ...prev, image: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveListing = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...prodForm,
        pricePerDay: Number(prodForm.pricePerDay),
        totalUnits: Number(prodForm.totalUnits),
      };
      if (editingProduct) {
        await apiRequest(`/api/provider/products/${editingProduct.id}`, {
          method: 'PUT',
          body: payload,
        });
        onToast('Listing updated.');
      } else {
        await apiRequest('/api/provider/products', { method: 'POST', body: payload });
        onToast('Listing submitted for admin approval.');
      }
      setListingModalOpen(false);
      await loadProviderData();
      await onDataUpdated();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to save listing.', 'error');
    }
  };

  const handleToggleAvailability = async (p: Product) => {
    try {
      await apiRequest(`/api/provider/products/${p.id}/condition`, {
        method: 'PATCH',
        body: { available: !p.available },
      });
      await loadProviderData();
      await onDataUpdated();
      onToast(`${p.name} marked ${!p.available ? 'Available' : 'Unavailable'}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to update availability.', 'error');
    }
  };

  const handleDeleteListing = async (p: Product) => {
    try {
      await apiRequest(`/api/provider/products/${p.id}`, { method: 'DELETE' });
      await loadProviderData();
      await onDataUpdated();
      onToast(`Removed ${p.name}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to delete listing.', 'error');
    }
  };

  const openConditionModal = (p: Product) => {
    setConditionTarget(p);
    setConditionForm({
      condition: p.condition,
      conditionNotes: p.conditionNotes,
      available: p.available,
    });
  };

  const handleSaveCondition = async (e: FormEvent) => {
    e.preventDefault();
    if (!conditionTarget) return;
    try {
      await apiRequest(`/api/provider/products/${conditionTarget.id}/condition`, {
        method: 'PATCH',
        body: conditionForm,
      });
      setConditionTarget(null);
      await loadProviderData();
      await onDataUpdated();
      onToast('Product condition updated.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to update condition.', 'error');
    }
  };

  const handleBookingStatusChange = async (orderId: string, status: OrderStatus) => {
    try {
      await apiRequest(`/api/provider/orders/${orderId}/status`, {
        method: 'PATCH',
        body: { status },
      });
      await loadProviderData();
      await onDataUpdated();
      onToast(`Booking updated to ${status}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to update booking status.', 'error');
    }
  };

  const openReportReview = (rep: ConditionReport) => {
    setReviewingReport(rep);
    setReviewForm({
      adminStatus: rep.damageDetected ? 'Damage Flagged' : 'Reviewed - Cleared',
      damageDetected: rep.damageDetected,
      adminNotes: rep.adminNotes || '',
      updateProductConditionTo:
        rep.reportedCondition === 'Damaged' ? 'Needs Maintenance' : rep.reportedCondition,
      updateProductConditionNotes: rep.customerNotes,
      setProductAvailable: rep.reportedCondition !== 'Damaged',
    });
  };

  const handleSaveReportReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!reviewingReport) return;
    try {
      await apiRequest(`/api/provider/condition-reports/${reviewingReport.id}`, {
        method: 'PATCH',
        body: reviewForm,
      });
      setReviewingReport(null);
      await loadProviderData();
      await onDataUpdated();
      onToast('Return inspection saved and product condition updated.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to update inspection.', 'error');
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await apiRequest<{ user: User }>('/api/provider/profile', {
        method: 'PUT',
        body: profileForm,
      });
      if (res.user) onUserUpdated(res.user);
      await loadProviderData();
      await onDataUpdated();
      onToast('Provider profile updated across all your listings.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const navItems: { id: ProviderSection; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'listings', label: 'My Listings', icon: Package },
    { id: 'bookings', label: 'Booking Requests', icon: ClipboardList },
    { id: 'reports', label: 'Returns & Condition', icon: ShieldAlert },
    { id: 'profile', label: 'Provider Profile', icon: Store },
  ];

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#F6F7FB] lg:flex">
      {/* Provider Sidebar */}
      <aside className="w-full shrink-0 border-b border-[#E5E8F0] bg-white lg:w-64 lg:border-r lg:border-b-0">
        <div className="border-b border-[#E5E8F0] px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5478D5]">
            Provider Console
          </p>
          <p className="mt-0.5 truncate font-display text-base font-bold text-[#252A34]">
            {user.providerProfile?.businessName || user.fullName}
          </p>
          <p className="truncate text-xs text-[#646B7A]">
            {user.providerProfile?.city || 'Verified Rental Partner'}
          </p>
        </div>

        <nav className="flex gap-1 overflow-x-auto p-3 lg:flex-col">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#E9EDFF] text-[#5478D5]'
                    : 'text-[#646B7A] hover:bg-[#F6F7FB] hover:text-[#252A34]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-[#E5E8F0] p-3">
          <button
            type="button"
            onClick={() => onNavigate('/products')}
            className="flex w-full items-center gap-2 rounded-xl bg-[#F6F7FB] px-3.5 py-2.5 text-xs font-semibold text-[#252A34] hover:bg-[#E9EDFF]"
          >
            <ShoppingBag className="h-4 w-4 text-[#5478D5]" />
            <span>Switch to Customer Mode</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="mt-1.5 flex w-full items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-[#DC2626] hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-5 sm:p-8">
        <div className="mx-auto max-w-[1050px]">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E8F0] pb-4">
            <div>
              <p className="text-xs text-[#646B7A]">
                Provider / {navItems.find((i) => i.id === section)?.label}
              </p>
              <h1 className="font-display text-2xl font-bold text-[#252A34]">
                {navItems.find((i) => i.id === section)?.label}
              </h1>
            </div>
            <button
              type="button"
              onClick={openNewListing}
              className="inline-flex items-center gap-2 rounded-xl bg-[#5478D5] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#4365BE]"
            >
              <Plus className="h-4 w-4" />
              <span>Add Rental Product</span>
            </button>
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-28 animate-pulse rounded-xl border border-[#E5E8F0] bg-white" />
              ))}
            </div>
          ) : (
            <>
              {/* OVERVIEW */}
              {section === 'overview' && overview && (
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-[#E5E8F0] bg-white p-5">
                      <p className="text-xs text-[#646B7A]">My Listings</p>
                      <p className="font-mono mt-1.5 text-2xl font-bold tabular-nums text-[#252A34]">
                        {overview.stats.totalListings}
                      </p>
                      <p className="mt-1 text-xs text-[#299B68]">
                        {overview.stats.approvedListings} live · {overview.stats.pendingListings}{' '}
                        pending approval
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E5E8F0] bg-white p-5">
                      <p className="text-xs text-[#646B7A]">New Booking Requests</p>
                      <p className="font-mono mt-1.5 text-2xl font-bold tabular-nums text-[#252A34]">
                        {overview.stats.bookingRequestsCount}
                      </p>
                      <p className="mt-1 text-xs text-[#5478D5]">
                        {overview.stats.activeRentalsCount} active rentals
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E5E8F0] bg-white p-5">
                      <p className="text-xs text-[#646B7A]">Return Reports</p>
                      <p className="font-mono mt-1.5 text-2xl font-bold tabular-nums text-[#252A34]">
                        {overview.stats.pendingReports}
                      </p>
                      <p className="mt-1 text-xs text-[#646B7A]">Pending inspection</p>
                    </div>
                    <div className="rounded-xl border border-[#E5E8F0] bg-white p-5">
                      <p className="text-xs text-[#646B7A]">Rental Earnings</p>
                      <p className="font-mono mt-1.5 text-2xl font-bold tabular-nums text-[#252A34]">
                        {formatInr(overview.stats.totalEarnings)}
                      </p>
                      <p className="mt-1 text-xs text-[#646B7A]">
                        Across {overview.stats.totalOrders} order(s)
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E5E8F0] bg-white p-6">
                    <h2 className="font-display text-base font-bold text-[#252A34]">
                      How Multi-Vendor Listing Approval Works
                    </h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#646B7A]">
                      New products you upload start as <span className="font-semibold text-[#D97706]">Pending Admin Approval</span>.
                      Once approved by an administrator, they appear on BorrowBox Explore Rentals with
                      your store name (<span className="font-semibold text-[#252A34]">{user.providerProfile?.businessName || user.fullName}</span>)
                      so customers can book them immediately.
                    </p>
                  </div>
                </div>
              )}

              {/* MY LISTINGS */}
              {section === 'listings' && (
                <div className="space-y-4">
                  {products.length === 0 ? (
                    <div className="rounded-2xl border border-[#E5E8F0] bg-white px-6 py-16 text-center">
                      <Package className="mx-auto h-10 w-10 text-[#5478D5]" />
                      <h2 className="font-display mt-3 text-lg font-bold text-[#252A34]">
                        No rental products listed yet
                      </h2>
                      <p className="mt-1 text-sm text-[#646B7A]">
                        Add your first camera, projector, calculator, or kit for rent.
                      </p>
                      <button
                        type="button"
                        onClick={openNewListing}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#5478D5] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#4365BE]"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Add Your First Product</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-5 md:grid-cols-2">
                      {products.map((p) => (
                        <div
                          key={p.id}
                          className="flex flex-col overflow-hidden rounded-2xl border border-[#E5E8F0] bg-white"
                        >
                          <div className="grid sm:grid-cols-12">
                            <div className="sm:col-span-5">
                              <ProductImage
                                src={p.image}
                                alt={p.name}
                                categoryName={p.categoryName}
                                aspectClass="aspect-[4/3] h-full"
                              />
                            </div>
                            <div className="flex flex-col justify-between p-4 sm:col-span-7">
                              <div>
                                <div className="flex items-center justify-between gap-2 text-[11px]">
                                  <span className="font-mono text-[#646B7A]">{p.code}</span>
                                  <span
                                    className={`font-semibold ${
                                      p.approvalStatus === 'approved'
                                        ? 'text-[#299B68]'
                                        : p.approvalStatus === 'rejected'
                                          ? 'text-[#DC2626]'
                                          : 'text-[#D97706]'
                                    }`}
                                  >
                                    {p.approvalStatus === 'approved'
                                      ? 'Approved & Live'
                                      : p.approvalStatus === 'rejected'
                                        ? 'Rejected'
                                        : 'Pending Admin Approval'}
                                  </span>
                                </div>
                                <h3 className="font-display mt-1 text-base font-bold text-[#252A34]">
                                  {p.name}
                                </h3>
                                <p className="mt-0.5 text-xs text-[#646B7A]">
                                  {p.categoryName} · {formatInr(p.pricePerDay)}/day · {p.totalUnits}{' '}
                                  unit(s)
                                </p>
                                <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[#252A34]">
                                  <ShieldCheck className="h-3.5 w-3.5 text-[#5478D5]" />
                                  <span>Condition: {p.condition}</span>
                                </p>
                                {p.approvalStatus === 'rejected' && p.approvalNote && (
                                  <p className="mt-1.5 rounded bg-red-50 px-2 py-1 text-[11px] text-[#DC2626]">
                                    Admin note: {p.approvalNote}
                                  </p>
                                )}
                              </div>

                              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E8F0] pt-3">
                                <button
                                  type="button"
                                  onClick={() => handleToggleAvailability(p)}
                                  className={`text-xs font-semibold hover:underline ${
                                    p.available ? 'text-[#299B68]' : 'text-[#DC2626]'
                                  }`}
                                >
                                  {p.available ? 'Available' : 'Unavailable'}
                                </button>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openConditionModal(p)}
                                    className="rounded-lg border border-[#E5E8F0] px-2.5 py-1 text-[11px] font-semibold text-[#252A34] hover:bg-[#F6F7FB]"
                                  >
                                    Condition
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEditListing(p)}
                                    className="rounded-lg p-1.5 text-[#5478D5] hover:bg-[#E9EDFF]"
                                    aria-label={`Edit ${p.name}`}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteListing(p)}
                                    className="rounded-lg p-1.5 text-[#DC2626] hover:bg-red-50"
                                    aria-label={`Delete ${p.name}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* BOOKING REQUESTS & RETURNS */}
              {section === 'bookings' && (
                <div className="space-y-4">
                  {orders.length === 0 ? (
                    <div className="rounded-2xl border border-[#E5E8F0] bg-white p-12 text-center text-sm text-[#646B7A]">
                      No booking requests for your listings yet.
                    </div>
                  ) : (
                    orders.map((order) => {
                      const currentItemStatus =
                        order.items[0]?.itemStatus || order.orderStatus;
                      return (
                        <div
                          key={order.id}
                          className="rounded-xl border border-[#E5E8F0] bg-white p-5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E8F0] pb-4">
                            <div>
                              <p className="font-mono text-sm font-bold text-[#252A34]">
                                {order.orderNumber}
                              </p>
                              <p className="mt-0.5 text-xs text-[#646B7A]">
                                Customer: {order.customerName} · {order.customerPhone} ·{' '}
                                {order.city} ({order.pinCode})
                              </p>
                              <p className="mt-0.5 text-xs text-[#646B7A]">
                                Payment: {order.paymentStatus}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-sm font-bold tabular-nums text-[#252A34]">
                                {formatInr(
                                  order.items.reduce((sum, i) => sum + i.lineTotal, 0),
                                )}
                              </span>
                              <select
                                value={currentItemStatus}
                                onChange={(e) =>
                                  handleBookingStatusChange(
                                    order.id,
                                    e.target.value as OrderStatus,
                                  )
                                }
                                className="rounded-lg border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 text-xs font-semibold text-[#252A34]"
                              >
                                {(
                                  [
                                    'Order Placed',
                                    'Confirmed',
                                    'Ready for Pickup',
                                    'Rented',
                                    'Returned',
                                    'Cancelled',
                                  ] as OrderStatus[]
                                ).map((st) => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="mt-3 space-y-2">
                            {order.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex flex-wrap items-center justify-between gap-2 text-xs"
                              >
                                <span className="font-medium text-[#252A34]">
                                  {item.productName} × {item.quantity}
                                </span>
                                <span className="text-[#646B7A]">
                                  {formatDisplayDate(item.startDate)} →{' '}
                                  {formatDisplayDate(item.endDate)} ({item.days} days)
                                </span>
                                <span className="font-mono font-semibold text-[#252A34]">
                                  {formatInr(item.lineTotal)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* RETURNS & CONDITION REPORTS */}
              {section === 'reports' && (
                <div className="space-y-4">
                  {reports.length === 0 ? (
                    <div className="rounded-2xl border border-[#E5E8F0] bg-white p-12 text-center text-sm text-[#646B7A]">
                      No return condition reports submitted for your products yet.
                    </div>
                  ) : (
                    reports.map((rep) => (
                      <div
                        key={rep.id}
                        className="rounded-xl border border-[#E5E8F0] bg-white p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 text-xs text-[#646B7A]">
                              <span className="font-mono font-semibold text-[#252A34]">
                                {rep.orderNumber}
                              </span>
                              <span>·</span>
                              <span>{rep.customerName}</span>
                              <span>·</span>
                              <span>{formatDisplayDate(rep.createdAt)}</span>
                            </div>
                            <h3 className="font-display mt-1 text-base font-bold text-[#252A34]">
                              {rep.productName}
                            </h3>
                            <p className="mt-1 text-xs text-[#646B7A]">
                              Reported Return Condition:{' '}
                              <span
                                className={`font-semibold ${
                                  rep.reportedCondition === 'Damaged'
                                    ? 'text-[#DC2626]'
                                    : 'text-[#299B68]'
                                }`}
                              >
                                {rep.reportedCondition}
                              </span>{' '}
                              · Status:{' '}
                              <span className="font-semibold text-[#5478D5]">
                                {rep.adminStatus}
                              </span>
                            </p>
                            <p className="mt-2 rounded-lg bg-[#F6F7FB] p-3 text-xs text-[#252A34]">
                              &ldquo;{rep.customerNotes}&rdquo;
                            </p>

                            {rep.photos.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {rep.photos.map((src, i) => (
                                  <img
                                    key={i}
                                    src={src}
                                    alt={`Return photo ${i + 1}`}
                                    className="h-20 w-24 rounded-lg border border-[#E5E8F0] object-cover"
                                  />
                                ))}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => openReportReview(rep)}
                            className="rounded-xl bg-[#5478D5] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4365BE]"
                          >
                            Inspect Return &amp; Update Condition
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* PROVIDER PROFILE SETTINGS */}
              {section === 'profile' && (
                <form
                  onSubmit={handleSaveProfile}
                  className="max-w-2xl space-y-4 rounded-2xl border border-[#E5E8F0] bg-white p-6"
                >
                  <h2 className="font-display text-lg font-bold text-[#252A34]">
                    Public Provider Details
                  </h2>
                  <p className="text-xs text-[#646B7A]">
                    These details appear on every product page you list so customers know who they
                    are renting from.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#252A34]">
                        Store / Provider Name
                      </label>
                      <input
                        type="text"
                        required
                        value={profileForm.businessName}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, businessName: e.target.value })
                        }
                        className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#252A34]">
                        City / Pickup Hub
                      </label>
                      <input
                        type="text"
                        required
                        value={profileForm.city}
                        onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                        className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 text-sm"
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
                      value={profileForm.contactPhone}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, contactPhone: e.target.value })
                      }
                      className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#252A34]">
                      Provider Bio &amp; Rental Guidelines
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                      className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="rounded-xl bg-[#5478D5] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4365BE] disabled:opacity-50"
                  >
                    {savingProfile ? 'Saving...' : 'Save Provider Profile'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </main>

      {/* Add / Edit Listing Modal with Image Upload */}
      {listingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252A34]/40 p-4">
          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#E5E8F0] bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setListingModalOpen(false)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-[#646B7A] hover:bg-[#F6F7FB]"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="font-display text-xl font-bold text-[#252A34]">
              {editingProduct ? 'Edit Rental Listing' : 'Add Rental Listing'}
            </h2>
            <p className="mt-0.5 text-xs text-[#646B7A]">
              New listings are reviewed by an administrator before appearing to customers.
            </p>

            <form onSubmit={handleSaveListing} className="mt-4 space-y-3.5 text-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-medium text-[#252A34]">Product Name</label>
                  <input
                    type="text"
                    required
                    value={prodForm.name}
                    onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                    placeholder="e.g. Sony A7 III Mirror-less"
                    className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#252A34]">Product Code</label>
                  <input
                    type="text"
                    required
                    value={prodForm.code}
                    onChange={(e) => setProdForm({ ...prodForm, code: e.target.value })}
                    className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-medium text-[#252A34]">Category</label>
                  <select
                    value={prodForm.categoryId}
                    onChange={(e) => setProdForm({ ...prodForm, categoryId: e.target.value })}
                    className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 text-sm"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#252A34]">Price / Day (₹)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={prodForm.pricePerDay}
                    onChange={(e) => setProdForm({ ...prodForm, pricePerDay: e.target.value })}
                    className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#252A34]">Units</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={prodForm.totalUnits}
                    onChange={(e) => setProdForm({ ...prodForm, totalUnits: e.target.value })}
                    className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-medium text-[#252A34]">
                    Pre-Rental Condition
                  </label>
                  <select
                    value={prodForm.condition}
                    onChange={(e) =>
                      setProdForm({ ...prodForm, condition: e.target.value as ProductCondition })
                    }
                    className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 text-sm"
                  >
                    <option value="Mint">Mint</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Needs Maintenance">Needs Maintenance</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#252A34]">Condition Notes</label>
                  <input
                    type="text"
                    value={prodForm.conditionNotes}
                    onChange={(e) => setProdForm({ ...prodForm, conditionNotes: e.target.value })}
                    className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium text-[#252A34]">Description</label>
                <textarea
                  rows={2}
                  required
                  value={prodForm.description}
                  onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                  placeholder="Describe specs, included accessories, and pickup details..."
                  className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-[#252A34]">
                  Product Photo (Upload file, pick preset, or paste URL)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2 text-xs font-semibold text-[#5478D5] hover:bg-[#E9EDFF]">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload Image</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleImageFileUpload}
                      className="hidden"
                    />
                  </label>
                  <input
                    type="text"
                    required
                    value={prodForm.image.startsWith('data:image/') ? '[Uploaded Image]' : prodForm.image}
                    onChange={(e) => setProdForm({ ...prodForm, image: e.target.value })}
                    placeholder="https://... or images/product.jpg"
                    className="flex-1 rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 font-mono text-xs"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {IMAGE_PRESETS.map((preset) => (
                    <button
                      key={preset.path}
                      type="button"
                      onClick={() => setProdForm({ ...prodForm, image: preset.path })}
                      className="rounded-lg border border-[#E5E8F0] bg-[#F6F7FB] px-2 py-1 text-[11px] hover:bg-[#E9EDFF]"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {prodForm.image && (
                  <div className="mt-3 w-40 overflow-hidden rounded-xl border border-[#E5E8F0]">
                    <ProductImage src={prodForm.image} alt="Preview" aspectClass="aspect-[4/3]" />
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 pt-1 font-medium text-[#252A34]">
                <input
                  type="checkbox"
                  checked={prodForm.available}
                  onChange={(e) => setProdForm({ ...prodForm, available: e.target.checked })}
                  className="accent-[#5478D5]"
                />
                <span>Available for Rental</span>
              </label>

              <button
                type="submit"
                className="w-full rounded-xl bg-[#5478D5] py-2.5 text-sm font-semibold text-white hover:bg-[#4365BE]"
              >
                {editingProduct ? 'Save Changes' : 'Submit Listing for Approval'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Quick Condition Update Modal */}
      {conditionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252A34]/40 p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-[#E5E8F0] bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setConditionTarget(null)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-[#646B7A] hover:bg-[#F6F7FB]"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="font-display text-lg font-bold text-[#252A34]">
              Update Item Condition
            </h2>
            <p className="mt-0.5 text-xs text-[#646B7A]">{conditionTarget.name}</p>
            <form onSubmit={handleSaveCondition} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="mb-1 block font-medium text-[#252A34]">Condition</label>
                <select
                  value={conditionForm.condition}
                  onChange={(e) =>
                    setConditionForm({
                      ...conditionForm,
                      condition: e.target.value as ProductCondition,
                    })
                  }
                  className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 text-sm"
                >
                  <option value="Mint">Mint</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Needs Maintenance">Needs Maintenance</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block font-medium text-[#252A34]">Condition Notes</label>
                <textarea
                  rows={2}
                  value={conditionForm.conditionNotes}
                  onChange={(e) =>
                    setConditionForm({ ...conditionForm, conditionNotes: e.target.value })
                  }
                  className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 font-medium text-[#252A34]">
                <input
                  type="checkbox"
                  checked={conditionForm.available}
                  onChange={(e) =>
                    setConditionForm({ ...conditionForm, available: e.target.checked })
                  }
                  className="accent-[#5478D5]"
                />
                <span>Available for Rent</span>
              </label>
              <button
                type="submit"
                className="w-full rounded-xl bg-[#5478D5] py-2.5 text-sm font-semibold text-white hover:bg-[#4365BE]"
              >
                Save Condition Update
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Return Condition Report Inspection Modal */}
      {reviewingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252A34]/40 p-4">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E5E8F0] bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setReviewingReport(null)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-[#646B7A] hover:bg-[#F6F7FB]"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="font-display text-lg font-bold text-[#252A34]">
              Inspect Return Condition Report
            </h2>
            <p className="mt-1 text-xs text-[#646B7A]">
              {reviewingReport.productName} · Order {reviewingReport.orderNumber}
            </p>

            <form onSubmit={handleSaveReportReview} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="mb-1 block font-medium text-[#252A34]">Inspection Decision</label>
                <select
                  value={reviewForm.adminStatus}
                  onChange={(e) =>
                    setReviewForm({
                      ...reviewForm,
                      adminStatus: e.target.value as ReportReviewStatus,
                      damageDetected: e.target.value === 'Damage Flagged',
                    })
                  }
                  className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 text-sm"
                >
                  <option value="Reviewed - Cleared">Reviewed - Cleared</option>
                  <option value="Damage Flagged">Damage Flagged</option>
                  <option value="Pending Review">Pending Review</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block font-medium text-[#252A34]">Inspection Notes</label>
                <textarea
                  rows={2}
                  value={reviewForm.adminNotes}
                  onChange={(e) => setReviewForm({ ...reviewForm, adminNotes: e.target.value })}
                  className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 text-sm"
                />
              </div>
              <div className="border-t border-[#E5E8F0] pt-3">
                <p className="font-semibold text-[#252A34]">Update Listing Condition</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <select
                    value={reviewForm.updateProductConditionTo}
                    onChange={(e) =>
                      setReviewForm({
                        ...reviewForm,
                        updateProductConditionTo: e.target.value as ProductCondition,
                      })
                    }
                    className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 text-sm"
                  >
                    <option value="Mint">Mint</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Needs Maintenance">Needs Maintenance</option>
                  </select>
                  <label className="flex items-center gap-2 font-medium text-[#252A34]">
                    <input
                      type="checkbox"
                      checked={reviewForm.setProductAvailable}
                      onChange={(e) =>
                        setReviewForm({ ...reviewForm, setProductAvailable: e.target.checked })
                      }
                      className="accent-[#5478D5]"
                    />
                    <span>Keep Listing Available</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={reviewForm.updateProductConditionNotes}
                  onChange={(e) =>
                    setReviewForm({ ...reviewForm, updateProductConditionNotes: e.target.value })
                  }
                  placeholder="Condition note for next customer"
                  className="mt-2 w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-[#5478D5] py-2.5 text-sm font-semibold text-white hover:bg-[#4365BE]"
              >
                Save Return Inspection
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
