import { useState, useEffect, type FormEvent } from 'react';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Layers,
  ClipboardList,
  ShieldAlert,
  Users,
  Store,
  CheckCircle2,
  XCircle,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  X,
  ExternalLink,
} from 'lucide-react';
import type {
  AdminOverview,
  AppRoute,
  Bundle,
  Category,
  ConditionReport,
  CustomerSummary,
  ListingApprovalStatus,
  Order,
  OrderStatus,
  Product,
  ProductCondition,
  ProviderSummary,
  ReportReviewStatus,
  User,
} from '../types';
import { apiRequest, formatDisplayDate, formatInr } from '../lib/api';

interface AdminDashboardPageProps {
  user: User | null;
  onNavigate: (route: AppRoute) => void;
  onLogout: () => Promise<void>;
  onDataUpdated: () => Promise<void>;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

type AdminSection =
  | 'overview'
  | 'providers'
  | 'products'
  | 'bundles'
  | 'categories'
  | 'orders'
  | 'reports'
  | 'customers';

const STUDIO_IMAGE_PRESETS = [
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
    label: 'Badminton Kit',
    path: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ad/Rachet%C4%83_de_badminton_%C5%9Fi_flutura%C5%9F.jpg/960px-Rachet%C4%83_de_badminton_%C5%9Fi_flutura%C5%9F.jpg',
  },
  {
    label: 'Tripod Stand',
    path: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c7/%28Photography_equipment_Tripod_Photo_Camera_Tripod_photograph_in_a_studio%29.jpg/960px-%28Photography_equipment_Tripod_Photo_Camera_Tripod_photograph_in_a_studio%29.jpg',
  },
  {
    label: 'Calculator',
    path: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ce/Casio_fx-991EX_Scientific_Calculator.jpg/960px-Casio_fx-991EX_Scientific_Calculator.jpg',
  },
  {
    label: 'Lighting Kit',
    path: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f9/PhotoSEL_LS21E52_Softbox_Studio_Lighting_Kit.JPG/960px-PhotoSEL_LS21E52_Softbox_Studio_Lighting_Kit.JPG',
  },
  {
    label: 'Microphone',
    path: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2e/Blue_Snowflake_USB_microphone.jpg/960px-Blue_Snowflake_USB_microphone.jpg',
  },
];

export function AdminDashboardPage({
  user,
  onNavigate,
  onLogout,
  onDataUpdated,
  onToast,
}: AdminDashboardPageProps) {
  const [section, setSection] = useState<AdminSection>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reports, setReports] = useState<ConditionReport[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [productApprovalFilter, setProductApprovalFilter] = useState<'all' | ListingApprovalStatus>(
    'all',
  );
  const [rejectionModal, setRejectionModal] = useState<{
    type: 'provider' | 'product';
    id: string;
    name: string;
  } | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [loading, setLoading] = useState(true);

  // Product Form Modal
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodForm, setProdForm] = useState({
    name: '',
    code: '',
    description: '',
    categoryId: '',
    pricePerDay: '250',
    image: STUDIO_IMAGE_PRESETS[0].path,
    totalUnits: '2',
    available: true,
    featured: false,
    condition: 'Mint' as ProductCondition,
    conditionNotes: 'Inspected and ready for rental.',
  });

  // Category Form Modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState({ name: '', description: '', image: '' });

  // Bundle Form Modal
  const [bundleModalOpen, setBundleModalOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const [bundleForm, setBundleForm] = useState({
    name: '',
    code: '',
    description: '',
    image: STUDIO_IMAGE_PRESETS[0].path,
    productIds: [] as string[],
    bundlePricePerDay: '500',
    featured: true,
  });

  // Condition Report Inspection Modal
  const [reviewingReport, setReviewingReport] = useState<ConditionReport | null>(null);
  const [reviewForm, setReviewForm] = useState({
    adminStatus: 'Reviewed - Cleared' as ReportReviewStatus,
    damageDetected: false,
    adminNotes: '',
    updateProductConditionTo: 'Good' as ProductCondition,
    updateProductConditionNotes: '',
    setProductAvailable: true,
  });

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const [ov, pr, bn, ct, ord, rep, cust, prov] = await Promise.all([
        apiRequest<AdminOverview>('/api/admin/overview'),
        apiRequest<{ products: Product[] }>('/api/admin/products'),
        apiRequest<{ bundles: Bundle[] }>('/api/admin/bundles'),
        apiRequest<{ categories: Category[] }>('/api/admin/categories'),
        apiRequest<{ orders: Order[] }>('/api/admin/orders'),
        apiRequest<{ reports: ConditionReport[] }>('/api/admin/condition-reports'),
        apiRequest<{ customers: CustomerSummary[] }>('/api/admin/customers'),
        apiRequest<{ providers: ProviderSummary[] }>('/api/admin/providers'),
      ]);
      setOverview(ov);
      setProducts(pr.products);
      setBundles(bn.bundles);
      setCategories(ct.categories);
      setOrders(ord.orders);
      setReports(rep.reports);
      setCustomers(cust.customers);
      setProviders(prov.providers);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to load admin data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      onNavigate('/admin-login');
      return;
    }
    loadAllAdminData();
  }, [user]);

  if (!user || user.role !== 'admin') {
    return null;
  }

  const openNewProduct = () => {
    setEditingProduct(null);
    setProdForm({
      name: '',
      code: `BB-NEW-${Math.floor(100 + Math.random() * 899)}`,
      description: '',
      categoryId: categories[0]?.id || '',
      pricePerDay: '250',
      image: STUDIO_IMAGE_PRESETS[0].path,
      totalUnits: '2',
      available: true,
      featured: false,
      condition: 'Mint',
      conditionNotes: 'Inspected and ready for rental.',
    });
    setProductModalOpen(true);
  };

  const openEditProduct = (p: Product) => {
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
      featured: p.featured,
      condition: p.condition,
      conditionNotes: p.conditionNotes,
    });
    setProductModalOpen(true);
  };

  const handleSaveProduct = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...prodForm,
        pricePerDay: Number(prodForm.pricePerDay),
        totalUnits: Number(prodForm.totalUnits),
      };
      if (editingProduct) {
        await apiRequest(`/api/admin/products/${editingProduct.id}`, {
          method: 'PUT',
          body: payload,
        });
        onToast('Product updated.');
      } else {
        await apiRequest('/api/admin/products', { method: 'POST', body: payload });
        onToast('Product added to catalogue.');
      }
      setProductModalOpen(false);
      await loadAllAdminData();
      await onDataUpdated();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to save product.', 'error');
    }
  };

  const handleToggleProductAvailability = async (p: Product) => {
    try {
      await apiRequest(`/api/admin/products/${p.id}`, {
        method: 'PUT',
        body: { available: !p.available },
      });
      await loadAllAdminData();
      await onDataUpdated();
      onToast(`${p.name} marked ${!p.available ? 'Available' : 'Unavailable'}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not update availability.', 'error');
    }
  };

  const handleDeleteProduct = async (p: Product) => {
    try {
      await apiRequest(`/api/admin/products/${p.id}`, { method: 'DELETE' });
      await loadAllAdminData();
      await onDataUpdated();
      onToast(`Deleted ${p.name}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to delete product.', 'error');
    }
  };

  const handleApproveProduct = async (p: Product) => {
    try {
      await apiRequest(`/api/admin/products/${p.id}/approval`, {
        method: 'PATCH',
        body: { approvalStatus: 'approved', approvalNote: '' },
      });
      await loadAllAdminData();
      await onDataUpdated();
      onToast(`Approved "${p.name}" for marketplace listing.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to approve listing.', 'error');
    }
  };

  const handleApproveProvider = async (prov: ProviderSummary) => {
    try {
      await apiRequest(`/api/admin/providers/${prov.id}/status`, {
        method: 'PATCH',
        body: { status: 'approved', reviewNote: '' },
      });
      await loadAllAdminData();
      await onDataUpdated();
      onToast(
        `${prov.providerProfile?.businessName || prov.fullName} approved as a Rental Provider.`,
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to approve provider.', 'error');
    }
  };

  const handleConfirmRejection = async (e: FormEvent) => {
    e.preventDefault();
    if (!rejectionModal) return;
    try {
      if (rejectionModal.type === 'provider') {
        await apiRequest(`/api/admin/providers/${rejectionModal.id}/status`, {
          method: 'PATCH',
          body: { status: 'rejected', reviewNote: rejectionNote.trim() },
        });
        onToast(`Provider "${rejectionModal.name}" rejected / suspended.`);
      } else {
        await apiRequest(`/api/admin/products/${rejectionModal.id}/approval`, {
          method: 'PATCH',
          body: { approvalStatus: 'rejected', approvalNote: rejectionNote.trim() },
        });
        onToast(`Listing "${rejectionModal.name}" rejected.`);
      }
      setRejectionModal(null);
      setRejectionNote('');
      await loadAllAdminData();
      await onDataUpdated();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to submit rejection.', 'error');
    }
  };

  const handleSaveCategory = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingCat) {
        await apiRequest(`/api/admin/categories/${editingCat.id}`, {
          method: 'PUT',
          body: catForm,
        });
        onToast('Category updated.');
      } else {
        await apiRequest('/api/admin/categories', { method: 'POST', body: catForm });
        onToast('Category created.');
      }
      setCatModalOpen(false);
      await loadAllAdminData();
      await onDataUpdated();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to save category.', 'error');
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    try {
      await apiRequest(`/api/admin/categories/${cat.id}`, { method: 'DELETE' });
      await loadAllAdminData();
      await onDataUpdated();
      onToast(`Deleted category ${cat.name}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to delete category.', 'error');
    }
  };

  const openNewBundle = () => {
    setEditingBundle(null);
    setBundleForm({
      name: '',
      code: `BB-KIT-${Math.floor(10 + Math.random() * 89)}`,
      description: '',
      image: STUDIO_IMAGE_PRESETS[0].path,
      productIds: products.slice(0, 2).map((p) => p.id),
      bundlePricePerDay: '450',
      featured: true,
    });
    setBundleModalOpen(true);
  };

  const openEditBundle = (b: Bundle) => {
    setEditingBundle(b);
    setBundleForm({
      name: b.name,
      code: b.code,
      description: b.description,
      image: b.image,
      productIds: b.productIds,
      bundlePricePerDay: String(b.bundlePricePerDay),
      featured: b.featured,
    });
    setBundleModalOpen(true);
  };

  const handleSaveBundle = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...bundleForm,
        bundlePricePerDay: Number(bundleForm.bundlePricePerDay),
      };
      if (editingBundle) {
        await apiRequest(`/api/admin/bundles/${editingBundle.id}`, {
          method: 'PUT',
          body: payload,
        });
        onToast('Rental bundle updated.');
      } else {
        await apiRequest('/api/admin/bundles', { method: 'POST', body: payload });
        onToast('Smart Rental Bundle created.');
      }
      setBundleModalOpen(false);
      await loadAllAdminData();
      await onDataUpdated();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to save bundle.', 'error');
    }
  };

  const handleDeleteBundle = async (b: Bundle) => {
    try {
      await apiRequest(`/api/admin/bundles/${b.id}`, { method: 'DELETE' });
      await loadAllAdminData();
      await onDataUpdated();
      onToast(`Deleted bundle ${b.name}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to delete bundle.', 'error');
    }
  };

  const handleOrderStatusChange = async (orderId: string, status: OrderStatus) => {
    try {
      await apiRequest(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        body: { status },
      });
      await loadAllAdminData();
      await onDataUpdated();
      onToast(`Order status updated to ${status}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to update order status.', 'error');
    }
  };

  const openReportReview = (rep: ConditionReport) => {
    setReviewingReport(rep);
    setReviewForm({
      adminStatus: rep.damageDetected ? 'Damage Flagged' : 'Reviewed - Cleared',
      damageDetected: rep.damageDetected,
      adminNotes: rep.adminNotes || '',
      updateProductConditionTo: rep.reportedCondition === 'Damaged' ? 'Needs Maintenance' : rep.reportedCondition,
      updateProductConditionNotes: rep.customerNotes,
      setProductAvailable: rep.reportedCondition !== 'Damaged',
    });
  };

  const handleSaveReportReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!reviewingReport) return;
    try {
      await apiRequest(`/api/admin/condition-reports/${reviewingReport.id}`, {
        method: 'PATCH',
        body: reviewForm,
      });
      setReviewingReport(null);
      await loadAllAdminData();
      await onDataUpdated();
      onToast('Condition report reviewed and product status updated.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to save review.', 'error');
    }
  };

  const navItems: {
    id: AdminSection;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: number;
  }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    {
      id: 'providers',
      label: 'Providers',
      icon: Store,
      badge: overview?.stats.pendingProviders || 0,
    },
    {
      id: 'products',
      label: 'Products & Approvals',
      icon: Package,
      badge: overview?.stats.pendingListingApprovals || 0,
    },
    { id: 'bundles', label: 'Smart Bundles', icon: Layers },
    { id: 'categories', label: 'Categories', icon: FolderTree },
    { id: 'orders', label: 'Orders', icon: ClipboardList },
    {
      id: 'reports',
      label: 'Condition Reports',
      icon: ShieldAlert,
      badge: overview?.stats.pendingReports || 0,
    },
    { id: 'customers', label: 'Users', icon: Users },
  ];

  const filteredProducts =
    productApprovalFilter === 'all'
      ? products
      : products.filter((p) => p.approvalStatus === productApprovalFilter);

  const pendingProductCount = products.filter((p) => p.approvalStatus === 'pending').length;
  const approvedProductCount = products.filter((p) => p.approvalStatus === 'approved').length;
  const rejectedProductCount = products.filter((p) => p.approvalStatus === 'rejected').length;

  return (
    <div className="min-h-screen bg-[#F6F7FB] lg:flex">
      {/* Admin Sidebar */}
      <aside className="w-full shrink-0 border-b border-[#E5E8F0] bg-white lg:w-64 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between border-b border-[#E5E8F0] px-5 py-4">
          <div>
            <span className="font-display text-lg font-bold text-[#252A34]">
              Borrow<span className="text-[#5478D5]">Box</span>
            </span>
            <p className="text-[11px] font-medium text-[#646B7A]">Admin Console</p>
          </div>
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
                className={`flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#E9EDFF] text-[#5478D5]'
                    : 'text-[#646B7A] hover:bg-[#F6F7FB] hover:text-[#252A34]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="rounded-md bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-800">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-[#E5E8F0] p-3 lg:mt-auto">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="flex w-full items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-[#646B7A] hover:bg-[#F6F7FB] hover:text-[#252A34]"
          >
            <ExternalLink className="h-4 w-4" />
            <span>View Storefront</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="mt-1 flex w-full items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-[#DC2626] hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            <span>Admin Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-5 sm:p-8">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E8F0] pb-4">
            <div>
              <p className="text-xs text-[#646B7A]">Admin / {navItems.find((i) => i.id === section)?.label}</p>
              <h1 className="font-display text-2xl font-bold text-[#252A34]">
                {navItems.find((i) => i.id === section)?.label}
              </h1>
            </div>
            <p className="text-xs text-[#646B7A]">Signed in as {user.email}</p>
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
                <div className="space-y-8">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-[#E5E8F0] bg-white p-5">
                      <p className="text-xs text-[#646B7A]">Total Products</p>
                      <p className="font-mono mt-1.5 text-2xl font-bold tabular-nums text-[#252A34]">
                        {overview.stats.totalProducts}
                      </p>
                      <p className="mt-1 text-xs text-[#299B68]">
                        {overview.stats.availableProducts} live &amp; available
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProductApprovalFilter('pending');
                        setSection('products');
                      }}
                      className="rounded-xl border border-[#E5E8F0] bg-white p-5 text-left transition-colors hover:border-[#5478D5]"
                    >
                      <p className="text-xs text-[#646B7A]">Pending Listing Approvals</p>
                      <p className="font-mono mt-1.5 text-2xl font-bold tabular-nums text-[#252A34]">
                        {overview.stats.pendingListingApprovals}
                      </p>
                      <p className="mt-1 text-xs font-medium text-[#5478D5]">
                        Review provider listings →
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSection('providers')}
                      className="rounded-xl border border-[#E5E8F0] bg-white p-5 text-left transition-colors hover:border-[#5478D5]"
                    >
                      <p className="text-xs text-[#646B7A]">Rental Providers</p>
                      <p className="font-mono mt-1.5 text-2xl font-bold tabular-nums text-[#252A34]">
                        {overview.stats.totalProviders}
                      </p>
                      <p className="mt-1 text-xs font-medium text-amber-700">
                        {overview.stats.pendingProviders} pending applications
                      </p>
                    </button>
                    <div className="rounded-xl border border-[#E5E8F0] bg-white p-5">
                      <p className="text-xs text-[#646B7A]">Orders &amp; Users</p>
                      <p className="font-mono mt-1.5 text-2xl font-bold tabular-nums text-[#252A34]">
                        {overview.stats.totalOrders}
                      </p>
                      <p className="mt-1 text-xs text-[#646B7A]">
                        {overview.stats.totalCustomers} users · {overview.stats.pendingReports} open
                        reports
                      </p>
                    </div>
                  </div>

                  {/* New Arrivals Priority Section */}
                  <div className="rounded-xl border border-[#E5E8F0] bg-white p-5">
                    <h2 className="font-display text-base font-bold text-[#252A34]">
                      New Arrivals (Sorted by Date Added)
                    </h2>
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-[#E5E8F0] text-[#646B7A]">
                          <tr>
                            <th className="pb-2.5 font-medium">Product</th>
                            <th className="pb-2.5 font-medium">Provider</th>
                            <th className="pb-2.5 font-medium">Category</th>
                            <th className="pb-2.5 font-medium">Approval</th>
                            <th className="pb-2.5 font-medium">Condition</th>
                            <th className="pb-2.5 text-right font-medium">Price/Day</th>
                            <th className="pb-2.5 text-right font-medium">Date Added</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E8F0]">
                          {overview.newArrivals.map((p) => (
                            <tr key={p.id} className="hover:bg-[#F6F7FB]/60">
                              <td className="py-3 font-medium text-[#252A34]">{p.name}</td>
                              <td className="py-3 text-[#646B7A]">{p.providerName}</td>
                              <td className="py-3 text-[#646B7A]">{p.categoryName}</td>
                              <td className="py-3">
                                <span
                                  className={`font-semibold capitalize ${
                                    p.approvalStatus === 'approved'
                                      ? 'text-[#299B68]'
                                      : p.approvalStatus === 'rejected'
                                        ? 'text-[#DC2626]'
                                        : 'text-amber-700'
                                  }`}
                                >
                                  {p.approvalStatus}
                                </span>
                              </td>
                              <td className="py-3 font-medium text-[#299B68]">{p.condition}</td>
                              <td className="py-3 text-right font-mono tabular-nums">
                                {formatInr(p.pricePerDay)}
                              </td>
                              <td className="py-3 text-right text-[#646B7A]">
                                {formatDisplayDate(p.createdAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* PROVIDERS & APPLICATIONS */}
              {section === 'providers' && (
                <div className="space-y-4">
                  {providers.length === 0 ? (
                    <div className="rounded-xl border border-[#E5E8F0] bg-white p-12 text-center text-sm text-[#646B7A]">
                      No users have applied to become Rental Providers yet.
                    </div>
                  ) : (
                    providers.map((prov) => {
                      const status = prov.providerStatus;
                      return (
                        <div
                          key={prov.id}
                          className="rounded-xl border border-[#E5E8F0] bg-white p-5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="max-w-2xl">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-display text-base font-bold text-[#252A34]">
                                  {prov.providerProfile?.businessName || prov.fullName}
                                </h3>
                                <span
                                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${
                                    status === 'approved'
                                      ? 'bg-emerald-50 text-[#299B68]'
                                      : status === 'rejected'
                                        ? 'bg-red-50 text-[#DC2626]'
                                        : 'bg-amber-50 text-amber-700'
                                  }`}
                                >
                                  {status}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-[#646B7A]">
                                Owner: <span className="font-medium text-[#252A34]">{prov.fullName}</span>{' '}
                                · {prov.email} · {prov.providerProfile?.contactPhone || prov.phone}
                              </p>
                              <p className="mt-0.5 text-xs text-[#646B7A]">
                                City: {prov.providerProfile?.city || 'Not set'} · Listings:{' '}
                                <span className="font-mono font-semibold text-[#252A34]">
                                  {prov.approvedListingCount}/{prov.listingCount}
                                </span>{' '}
                                live
                              </p>
                              {prov.providerProfile?.bio && (
                                <p className="mt-2 rounded-lg bg-[#F6F7FB] p-3 text-xs text-[#252A34]">
                                  {prov.providerProfile.bio}
                                </p>
                              )}
                              {prov.providerProfile?.reviewNote && (
                                <p className="mt-2 text-xs text-[#DC2626]">
                                  Admin note: {prov.providerProfile.reviewNote}
                                </p>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {status !== 'approved' && (
                                <button
                                  type="button"
                                  onClick={() => handleApproveProvider(prov)}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#299B68] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#228357]"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>Approve Provider</span>
                                </button>
                              )}
                              {status !== 'rejected' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectionNote('');
                                    setRejectionModal({
                                      type: 'provider',
                                      id: prov.id,
                                      name: prov.providerProfile?.businessName || prov.fullName,
                                    });
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-[#DC2626] hover:bg-red-100"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  <span>{status === 'approved' ? 'Suspend' : 'Reject'}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* PRODUCTS MANAGEMENT */}
              {section === 'products' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {(
                        [
                          { id: 'all', label: `All (${products.length})` },
                          { id: 'pending', label: `Pending (${pendingProductCount})` },
                          { id: 'approved', label: `Approved (${approvedProductCount})` },
                          { id: 'rejected', label: `Rejected (${rejectedProductCount})` },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setProductApprovalFilter(tab.id)}
                          className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            productApprovalFilter === tab.id
                              ? 'border-[#5478D5] bg-[#E9EDFF] text-[#5478D5]'
                              : 'border-[#E5E8F0] bg-white text-[#646B7A] hover:text-[#252A34]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={openNewProduct}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#5478D5] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#4365BE]"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Product</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-[#E5E8F0] bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[#E5E8F0] bg-[#F6F7FB] text-[#646B7A]">
                        <tr>
                          <th className="px-4 py-3 font-medium">Product</th>
                          <th className="px-4 py-3 font-medium">Provider</th>
                          <th className="px-4 py-3 font-medium">Category</th>
                          <th className="px-4 py-3 font-medium">Approval</th>
                          <th className="px-4 py-3 font-medium">Condition</th>
                          <th className="px-4 py-3 text-right font-medium">Rate/Day</th>
                          <th className="px-4 py-3 text-right font-medium">Units</th>
                          <th className="px-4 py-3 font-medium">Availability</th>
                          <th className="px-4 py-3 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E8F0]">
                        {filteredProducts.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-4 py-10 text-center text-[#646B7A]">
                              No listings match this filter.
                            </td>
                          </tr>
                        ) : (
                          filteredProducts.map((p) => (
                            <tr key={p.id} className="hover:bg-[#F6F7FB]/50">
                              <td className="px-4 py-3">
                                <p className="font-semibold text-[#252A34]">{p.name}</p>
                                <p className="font-mono text-[11px] text-[#646B7A]">{p.code}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-[#252A34]">{p.providerName}</p>
                                <p className="text-[11px] text-[#646B7A]">{p.providerCity}</p>
                              </td>
                              <td className="px-4 py-3 text-[#646B7A]">{p.categoryName}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${
                                    p.approvalStatus === 'approved'
                                      ? 'bg-emerald-50 text-[#299B68]'
                                      : p.approvalStatus === 'rejected'
                                        ? 'bg-red-50 text-[#DC2626]'
                                        : 'bg-amber-50 text-amber-700'
                                  }`}
                                >
                                  {p.approvalStatus}
                                </span>
                                {p.approvalNote && (
                                  <p className="mt-0.5 max-w-[160px] truncate text-[10px] text-[#646B7A]">
                                    {p.approvalNote}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-3 font-medium text-[#252A34]">{p.condition}</td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums">
                                {formatInr(p.pricePerDay)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums">
                                {p.totalUnits}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => handleToggleProductAvailability(p)}
                                  className={`font-semibold hover:underline ${
                                    p.available ? 'text-[#299B68]' : 'text-[#DC2626]'
                                  }`}
                                >
                                  {p.available ? 'Available' : 'Unavailable'}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex items-center gap-1">
                                  {p.approvalStatus !== 'approved' && (
                                    <button
                                      type="button"
                                      onClick={() => handleApproveProduct(p)}
                                      className="rounded-lg p-1.5 text-[#299B68] hover:bg-emerald-50"
                                      title="Approve listing"
                                      aria-label={`Approve ${p.name}`}
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  {p.approvalStatus !== 'rejected' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRejectionNote('');
                                        setRejectionModal({
                                          type: 'product',
                                          id: p.id,
                                          name: p.name,
                                        });
                                      }}
                                      className="rounded-lg p-1.5 text-amber-700 hover:bg-amber-50"
                                      title="Reject listing"
                                      aria-label={`Reject ${p.name}`}
                                    >
                                      <XCircle className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => openEditProduct(p)}
                                    className="rounded-lg p-1.5 text-[#5478D5] hover:bg-[#E9EDFF]"
                                    aria-label={`Edit ${p.name}`}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteProduct(p)}
                                    className="rounded-lg p-1.5 text-[#DC2626] hover:bg-red-50"
                                    aria-label={`Delete ${p.name}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SMART RENTAL BUNDLES MANAGEMENT */}
              {section === 'bundles' && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={openNewBundle}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#5478D5] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#4365BE]"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Create Smart Bundle</span>
                    </button>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    {bundles.map((b) => (
                      <div
                        key={b.id}
                        className="rounded-xl border border-[#E5E8F0] bg-white p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-mono text-xs text-[#646B7A]">{b.code}</p>
                            <h3 className="font-display mt-0.5 text-lg font-bold text-[#252A34]">
                              {b.name}
                            </h3>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditBundle(b)}
                              className="rounded-lg p-1.5 text-[#5478D5] hover:bg-[#E9EDFF]"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBundle(b)}
                              className="rounded-lg p-1.5 text-[#DC2626] hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-[#646B7A]">{b.description}</p>
                        <p className="mt-3 text-xs font-semibold text-[#252A34]">
                          Included: {b.products.map((p) => p.name).join(' + ')}
                        </p>
                        <div className="mt-3 flex items-center justify-between border-t border-[#E5E8F0] pt-3 text-xs">
                          <span className="font-mono font-bold text-[#252A34]">
                            Bundle Rate: {formatInr(b.bundlePricePerDay)}/day
                          </span>
                          <span className="text-[#299B68]">
                            Saves {formatInr(b.savingsPerDay)}/day
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CATEGORIES MANAGEMENT */}
              {section === 'categories' && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCat(null);
                        setCatForm({ name: '', description: '', image: '' });
                        setCatModalOpen(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#5478D5] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#4365BE]"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Category</span>
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {categories.map((cat) => (
                      <div
                        key={cat.id}
                        className="flex flex-col justify-between rounded-xl border border-[#E5E8F0] bg-white p-5"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-display text-base font-bold text-[#252A34]">
                              {cat.name}
                            </h3>
                            <span className="font-mono text-xs text-[#646B7A]">
                              {cat.productCount || 0} items
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs text-[#646B7A]">{cat.description}</p>
                        </div>
                        <div className="mt-4 flex items-center gap-2 border-t border-[#E5E8F0] pt-3">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCat(cat);
                              setCatForm({
                                name: cat.name,
                                description: cat.description,
                                image: cat.image,
                              });
                              setCatModalOpen(true);
                            }}
                            className="text-xs font-semibold text-[#5478D5] hover:underline"
                          >
                            Edit
                          </button>
                          <span className="text-[#E5E8F0]">|</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat)}
                            className="text-xs font-semibold text-[#DC2626] hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ORDERS MANAGEMENT */}
              {section === 'orders' && (
                <div className="space-y-4">
                  {orders.length === 0 ? (
                    <div className="rounded-xl border border-[#E5E8F0] bg-white p-12 text-center text-sm text-[#646B7A]">
                      No customer rental orders have been placed yet.
                    </div>
                  ) : (
                    orders.map((order) => (
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
                              {order.customerName} · {order.customerPhone} · {order.customerEmail}
                            </p>
                            <p className="mt-0.5 text-xs text-[#646B7A]">
                              {order.address}, {order.city} – {order.pinCode}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="font-mono text-base font-bold tabular-nums text-[#252A34]">
                              {formatInr(order.totalAmount)}
                            </span>
                            <select
                              value={order.orderStatus}
                              onChange={(e) =>
                                handleOrderStatusChange(order.id, e.target.value as OrderStatus)
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
                              <div>
                                <span className="font-medium text-[#252A34]">
                                  {item.productName} × {item.quantity}
                                </span>
                                {item.providerName && (
                                  <span className="ml-2 text-[#646B7A]">
                                    · Provider: {item.providerName}
                                  </span>
                                )}
                                {item.itemStatus && (
                                  <span className="ml-2 font-semibold text-[#5478D5]">
                                    ({item.itemStatus})
                                  </span>
                                )}
                              </div>
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
                    ))
                  )}
                </div>
              )}

              {/* CONDITION REPORTS MANAGEMENT */}
              {section === 'reports' && (
                <div className="space-y-4">
                  {reports.length === 0 ? (
                    <div className="rounded-xl border border-[#E5E8F0] bg-white p-12 text-center text-sm text-[#646B7A]">
                      No return condition reports submitted by customers yet.
                    </div>
                  ) : (
                    reports.map((rep) => (
                      <div
                        key={rep.id}
                        className="rounded-xl border border-[#E5E8F0] bg-white p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-[#646B7A]">
                              <span className="font-mono font-semibold text-[#252A34]">
                                {rep.orderNumber}
                              </span>
                              <span>·</span>
                              <span>Renter: {rep.customerName}</span>
                              {rep.providerName && (
                                <>
                                  <span>·</span>
                                  <span>Provider: {rep.providerName}</span>
                                </>
                              )}
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
                              · Review Status:{' '}
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
                                    alt={`Customer return ${i + 1}`}
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
                            Inspect &amp; Update Product
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* USERS MANAGEMENT */}
              {section === 'customers' && (
                <div className="overflow-x-auto rounded-xl border border-[#E5E8F0] bg-white">
                  {customers.length === 0 ? (
                    <div className="p-12 text-center text-sm text-[#646B7A]">
                      No registered users yet.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[#E5E8F0] bg-[#F6F7FB] text-[#646B7A]">
                        <tr>
                          <th className="px-4 py-3 font-medium">Name</th>
                          <th className="px-4 py-3 font-medium">Email</th>
                          <th className="px-4 py-3 font-medium">Role</th>
                          <th className="px-4 py-3 font-medium">Phone</th>
                          <th className="px-4 py-3 font-medium">Sign-Up Method</th>
                          <th className="px-4 py-3 text-right font-medium">Orders</th>
                          <th className="px-4 py-3 text-right font-medium">Registered</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E8F0]">
                        {customers.map((c) => (
                          <tr key={c.id} className="hover:bg-[#F6F7FB]/50">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-[#252A34]">{c.fullName}</p>
                              {c.businessName && (
                                <p className="text-[11px] text-[#5478D5]">{c.businessName}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[#646B7A]">{c.email}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${
                                  c.role === 'provider'
                                    ? 'bg-[#E9EDFF] text-[#5478D5]'
                                    : 'bg-[#F6F7FB] text-[#646B7A]'
                                }`}
                              >
                                {c.role}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-[#646B7A]">{c.phone}</td>
                            <td className="px-4 py-3 capitalize text-[#646B7A]">
                              {c.authProvider}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums">
                              {c.orderCount}
                            </td>
                            <td className="px-4 py-3 text-right text-[#646B7A]">
                              {formatDisplayDate(c.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Product Add/Edit Modal */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252A34]/40 p-4">
          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#E5E8F0] bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setProductModalOpen(false)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-[#646B7A] hover:bg-[#F6F7FB]"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="font-display text-xl font-bold text-[#252A34]">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h2>
            <form onSubmit={handleSaveProduct} className="mt-4 space-y-3.5 text-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-medium text-[#252A34]">Product Name</label>
                  <input
                    type="text"
                    required
                    value={prodForm.name}
                    onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
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
                  <label className="mb-1 block font-medium text-[#252A34]">Total Units</label>
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
                  className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-[#252A34]">
                  Image Path / URL (or pick preset)
                </label>
                <input
                  type="text"
                  required
                  value={prodForm.image}
                  onChange={(e) => setProdForm({ ...prodForm, image: e.target.value })}
                  className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 font-mono text-xs"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {STUDIO_IMAGE_PRESETS.map((preset) => (
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
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 font-medium text-[#252A34]">
                  <input
                    type="checkbox"
                    checked={prodForm.available}
                    onChange={(e) => setProdForm({ ...prodForm, available: e.target.checked })}
                    className="accent-[#5478D5]"
                  />
                  <span>Available for Rental</span>
                </label>
                <label className="flex items-center gap-2 font-medium text-[#252A34]">
                  <input
                    type="checkbox"
                    checked={prodForm.featured}
                    onChange={(e) => setProdForm({ ...prodForm, featured: e.target.checked })}
                    className="accent-[#5478D5]"
                  />
                  <span>Show in Featured</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-[#5478D5] py-2.5 text-sm font-semibold text-white hover:bg-[#4365BE]"
              >
                {editingProduct ? 'Save Changes' : 'Create Product'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Category Add/Edit Modal */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252A34]/40 p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-[#E5E8F0] bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setCatModalOpen(false)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-[#646B7A] hover:bg-[#F6F7FB]"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="font-display text-lg font-bold text-[#252A34]">
              {editingCat ? 'Edit Category' : 'Add Category'}
            </h2>
            <form onSubmit={handleSaveCategory} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="mb-1 block font-medium text-[#252A34]">Category Name</label>
                <input
                  type="text"
                  required
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-[#252A34]">Description</label>
                <textarea
                  rows={2}
                  required
                  value={catForm.description}
                  onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                  className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-[#252A34]">
                  Image Path (optional)
                </label>
                <input
                  type="text"
                  value={catForm.image}
                  onChange={(e) => setCatForm({ ...catForm, image: e.target.value })}
                  placeholder="images/category-default.jpg"
                  className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 font-mono text-xs"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-[#5478D5] py-2.5 text-sm font-semibold text-white hover:bg-[#4365BE]"
              >
                {editingCat ? 'Save Category' : 'Create Category'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Smart Bundle Add/Edit Modal */}
      {bundleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252A34]/40 p-4">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E5E8F0] bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setBundleModalOpen(false)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-[#646B7A] hover:bg-[#F6F7FB]"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="font-display text-lg font-bold text-[#252A34]">
              {editingBundle ? 'Edit Smart Bundle' : 'Create Smart Rental Bundle'}
            </h2>
            <form onSubmit={handleSaveBundle} className="mt-4 space-y-3.5 text-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-medium text-[#252A34]">Bundle Name</label>
                  <input
                    type="text"
                    required
                    value={bundleForm.name}
                    onChange={(e) => setBundleForm({ ...bundleForm, name: e.target.value })}
                    className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#252A34]">Bundle Code</label>
                  <input
                    type="text"
                    required
                    value={bundleForm.code}
                    onChange={(e) => setBundleForm({ ...bundleForm, code: e.target.value })}
                    className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 font-mono text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium text-[#252A34]">Description</label>
                <textarea
                  rows={2}
                  required
                  value={bundleForm.description}
                  onChange={(e) => setBundleForm({ ...bundleForm, description: e.target.value })}
                  className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-[#252A34]">
                  Bundle Price / Day (₹)
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={bundleForm.bundlePricePerDay}
                  onChange={(e) =>
                    setBundleForm({ ...bundleForm, bundlePricePerDay: e.target.value })
                  }
                  className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 font-mono text-sm"
                />
              </div>

              <div>
                <label className="mb-1.5 block font-medium text-[#252A34]">
                  Included Products (select at least 2)
                </label>
                <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] p-3">
                  {products.map((p) => {
                    const checked = bundleForm.productIds.includes(p.id);
                    return (
                      <label key={p.id} className="flex cursor-pointer items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...bundleForm.productIds, p.id]
                                : bundleForm.productIds.filter((id) => id !== p.id);
                              setBundleForm({ ...bundleForm, productIds: next });
                            }}
                            className="accent-[#5478D5]"
                          />
                          <span className="text-[#252A34]">{p.name}</span>
                        </span>
                        <span className="font-mono text-[#646B7A]">
                          {formatInr(p.pricePerDay)}/day
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium text-[#252A34]">Image URL / Path</label>
                <input
                  type="text"
                  required
                  value={bundleForm.image}
                  onChange={(e) => setBundleForm({ ...bundleForm, image: e.target.value })}
                  className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 font-mono text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-[#5478D5] py-2.5 text-sm font-semibold text-white hover:bg-[#4365BE]"
              >
                {editingBundle ? 'Save Bundle' : 'Create Bundle'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Condition Report Inspection Modal */}
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

              <label className="flex items-center gap-2 font-medium text-[#252A34]">
                <input
                  type="checkbox"
                  checked={reviewForm.damageDetected}
                  onChange={(e) =>
                    setReviewForm({ ...reviewForm, damageDetected: e.target.checked })
                  }
                  className="accent-[#DC2626]"
                />
                <span>Damage Detected During Inspection</span>
              </label>

              <div>
                <label className="mb-1 block font-medium text-[#252A34]">
                  Admin Inspection Notes
                </label>
                <textarea
                  rows={2}
                  value={reviewForm.adminNotes}
                  onChange={(e) => setReviewForm({ ...reviewForm, adminNotes: e.target.value })}
                  placeholder="Record inspection findings, cleaning status, or repair notes..."
                  className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 text-sm"
                />
              </div>

              <div className="border-t border-[#E5E8F0] pt-3">
                <p className="font-semibold text-[#252A34]">Update Product Condition Status</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[#646B7A]">New Product Condition</label>
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
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 font-medium text-[#252A34]">
                      <input
                        type="checkbox"
                        checked={reviewForm.setProductAvailable}
                        onChange={(e) =>
                          setReviewForm({
                            ...reviewForm,
                            setProductAvailable: e.target.checked,
                          })
                        }
                        className="accent-[#5478D5]"
                      />
                      <span>Keep Product Available</span>
                    </label>
                  </div>
                </div>
                <input
                  type="text"
                  value={reviewForm.updateProductConditionNotes}
                  onChange={(e) =>
                    setReviewForm({
                      ...reviewForm,
                      updateProductConditionNotes: e.target.value,
                    })
                  }
                  placeholder="Updated condition note shown to next renter"
                  className="mt-2 w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-[#5478D5] py-2.5 text-sm font-semibold text-white hover:bg-[#4365BE]"
              >
                Save Inspection &amp; Update Product
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Rejection / Suspension Reason Modal */}
      {rejectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252A34]/40 p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-[#E5E8F0] bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setRejectionModal(null)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-[#646B7A] hover:bg-[#F6F7FB]"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="font-display text-lg font-bold text-[#252A34]">
              {rejectionModal.type === 'provider'
                ? 'Reject / Suspend Provider'
                : 'Reject Product Listing'}
            </h2>
            <p className="mt-1 text-xs text-[#646B7A]">{rejectionModal.name}</p>
            <form onSubmit={handleConfirmRejection} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="mb-1 block font-medium text-[#252A34]">
                  Reason / Feedback (optional, shown to user)
                </label>
                <textarea
                  rows={3}
                  value={rejectionNote}
                  onChange={(e) => setRejectionNote(e.target.value)}
                  placeholder="Provide a clear reason so the provider can update and resubmit..."
                  className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectionModal(null)}
                  className="rounded-xl border border-[#E5E8F0] px-4 py-2 font-semibold text-[#646B7A] hover:bg-[#F6F7FB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#DC2626] px-4 py-2 font-semibold text-white hover:bg-red-700"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
