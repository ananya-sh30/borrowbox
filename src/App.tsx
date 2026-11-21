import { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import type { AppRoute, Bundle, CartSummary, Category, Product, User } from './types';
import {
  addDaysToDate,
  apiRequest,
  getTodayDateString,
  setAuthToken,
} from './lib/api';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProductDetailModal } from './components/ProductDetailModal';
import { BundleDetailModal } from './components/BundleDetailModal';
import { HomePage } from './pages/HomePage';
import { ProductsPage } from './pages/ProductsPage';
import { CartOrdersPage } from './pages/CartOrdersPage';
import { AdminLoginPage, LoginPage, SignupPage } from './pages/AuthPages';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { BecomeProviderPage } from './pages/BecomeProviderPage';
import { ProviderDashboardPage } from './pages/ProviderDashboardPage';

const VALID_ROUTES: AppRoute[] = [
  '/',
  '/products',
  '/cart',
  '/orders',
  '/become-provider',
  '/provider',
  '/login',
  '/signup',
  '/admin-login',
  '/admin',
];

function parseRouteFromPath(pathname: string): AppRoute {
  if (VALID_ROUTES.includes(pathname as AppRoute)) {
    return pathname as AppRoute;
  }
  return '/';
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() =>
    parseRouteFromPath(window.location.pathname),
  );
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [cart, setCart] = useState<CartSummary>({
    items: [],
    subtotal: 0,
    deliveryFee: 0,
    totalAmount: 0,
  });

  // Catalogue filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');
  const [cartTab, setCartTab] = useState<'cart' | 'orders'>('cart');

  // Modals & notifications
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null,
  );

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const refreshCatalogue = useCallback(async () => {
    const [catRes, prodRes, bundleRes] = await Promise.all([
      apiRequest<{ categories: Category[] }>('/api/categories'),
      apiRequest<{ products: Product[] }>('/api/products'),
      apiRequest<{ bundles: Bundle[] }>('/api/bundles'),
    ]);
    setCategories(catRes.categories);
    setProducts(prodRes.products);
    setBundles(bundleRes.bundles);
  }, []);

  const refreshCart = useCallback(async () => {
    const cartRes = await apiRequest<CartSummary>('/api/cart');
    setCart(cartRes);
  }, []);

  const refreshAuth = useCallback(async () => {
    const me = await apiRequest<{ user: User | null }>('/api/auth/me');
    setUser(me.user);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const catParam = params.get('category');
    const searchParam = params.get('search');
    if (catParam) setSelectedCategory(catParam);
    if (searchParam) setSearchQuery(searchParam);
    if (window.location.pathname === '/orders') setCartTab('orders');

    Promise.all([refreshAuth(), refreshCatalogue(), refreshCart()]).catch(() => {
      // handled gracefully on initial load
    });
  }, [refreshAuth, refreshCatalogue, refreshCart]);

  useEffect(() => {
    const onPopState = () => {
      const next = parseRouteFromPath(window.location.pathname);
      setRoute(next);
      if (next === '/orders') setCartTab('orders');
      if (next === '/cart') setCartTab('cart');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Listen for Google OAuth popup completion
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (!event.origin.endsWith('.run.app') && !event.origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        if (typeof event.data.token === 'string') {
          setAuthToken(event.data.token);
        }
        await refreshAuth();
        await refreshCart();
        showToast('Signed in with Google.');
        navigate('/');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refreshAuth, refreshCart, showToast]);

  const navigate = useCallback(
    (
      target: AppRoute,
      params?: { search?: string; category?: string; tab?: 'cart' | 'orders' },
    ) => {
      if (params?.search !== undefined) setSearchQuery(params.search);
      if (params?.category !== undefined) setSelectedCategory(params.category);
      if (params?.tab) setCartTab(params.tab);
      if (target === '/orders') setCartTab('orders');
      if (target === '/cart') setCartTab('cart');

      if (window.location.pathname !== target) {
        window.history.pushState({}, '', target);
      }
      setRoute(target);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [],
  );

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAuthToken(null);
    setUser(null);
    await refreshCart();
    showToast('Signed out successfully.');
    navigate(route === '/admin' ? '/admin-login' : '/');
  };

  const handleAuthSuccess = async (loggedInUser: User) => {
    setUser(loggedInUser);
    await refreshCart();
    showToast(`Welcome, ${loggedInUser.fullName.split(' ')[0]}!`);
  };

  const handleAddToCart = async (payload: {
    productId?: string;
    bundleId?: string;
    startDate: string;
    endDate: string;
    quantity: number;
  }) => {
    const updatedCart = await apiRequest<CartSummary>('/api/cart', {
      method: 'POST',
      body: payload,
    });
    setCart(updatedCart);
    showToast('Added to rental cart.');
  };

  const handleQuickAddProduct = async (
    product: Product,
    dateRange?: { startDate: string; endDate: string },
  ) => {
    const today = getTodayDateString();
    const startDate = dateRange?.startDate || today;
    const endDate = dateRange?.endDate || addDaysToDate(today, 2);
    try {
      await handleAddToCart({
        productId: product.id,
        startDate,
        endDate,
        quantity: 1,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Select custom dates.', 'error');
      setSelectedProduct(product);
    }
  };

  const featuredProducts = products.filter((p) => p.featured).slice(0, 6);
  const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const isAdminShell = route === '/admin' || route === '/admin-login';

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#252A34]">
      {!isAdminShell && (
        <Navbar
          currentRoute={route}
          onNavigate={navigate}
          user={user}
          cartCount={cartCount}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onLogout={handleLogout}
        />
      )}

      <main className="flex-1">
        {route === '/' && (
          <HomePage
            user={user}
            categories={categories}
            featuredProducts={featuredProducts.length > 0 ? featuredProducts : products.slice(0, 6)}
            bundles={bundles}
            onNavigate={navigate}
            onSelectProduct={setSelectedProduct}
            onSelectBundle={setSelectedBundle}
          />
        )}

        {route === '/products' && (
          <ProductsPage
            products={products}
            categories={categories}
            bundles={bundles}
            search={searchQuery}
            selectedCategory={selectedCategory}
            sortBy={sortBy}
            onSearchChange={setSearchQuery}
            onCategoryChange={setSelectedCategory}
            onSortChange={setSortBy}
            onSelectProduct={setSelectedProduct}
            onSelectBundle={setSelectedBundle}
            onQuickAddProduct={handleQuickAddProduct}
          />
        )}

        {(route === '/cart' || route === '/orders') && (
          <CartOrdersPage
            activeTab={cartTab}
            onTabChange={(tab) => {
              setCartTab(tab);
              navigate(tab === 'orders' ? '/orders' : '/cart', { tab });
            }}
            user={user}
            cart={cart}
            onRefreshCart={refreshCart}
            onNavigate={navigate}
            onToast={showToast}
          />
        )}

        {route === '/login' && (
          <LoginPage
            onNavigate={navigate}
            onAuthSuccess={handleAuthSuccess}
            onOpenLegal={setLegalModal}
          />
        )}

        {route === '/signup' && (
          <SignupPage
            onNavigate={navigate}
            onAuthSuccess={handleAuthSuccess}
            onOpenLegal={setLegalModal}
          />
        )}

        {route === '/admin-login' && (
          <AdminLoginPage onNavigate={navigate} onAuthSuccess={handleAuthSuccess} />
        )}

        {route === '/become-provider' && (
          <BecomeProviderPage
            user={user}
            onNavigate={navigate}
            onUserUpdated={setUser}
            onRefreshAuth={refreshAuth}
            onToast={showToast}
          />
        )}

        {route === '/provider' && (
          <ProviderDashboardPage
            user={user}
            onNavigate={navigate}
            onUserUpdated={setUser}
            onLogout={handleLogout}
            onDataUpdated={refreshCatalogue}
            onToast={showToast}
          />
        )}

        {route === '/admin' && (
          <AdminDashboardPage
            user={user}
            onNavigate={navigate}
            onLogout={handleLogout}
            onDataUpdated={refreshCatalogue}
            onToast={showToast}
          />
        )}
      </main>

      {!isAdminShell && <Footer onNavigate={navigate} onOpenLegal={setLegalModal} />}

      {/* Modals */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={(payload) => handleAddToCart(payload)}
      />

      <BundleDetailModal
        bundle={selectedBundle}
        onClose={() => setSelectedBundle(null)}
        onAddBundleToCart={(payload) => handleAddToCart(payload)}
      />

      {/* Legal Modal (Terms & Privacy) */}
      {legalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#252A34]/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E5E8F0] bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setLegalModal(null)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-[#646B7A] hover:bg-[#F6F7FB]"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="font-display text-xl font-bold text-[#252A34]">
              {legalModal === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
            </h2>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#646B7A]">
              {legalModal === 'terms' ? (
                <>
                  <p>
                    1. Rental Duration: Daily rental fees apply from the selected start date through
                    the return date inclusive.
                  </p>
                  <p>
                    2. Equipment Care &amp; Condition Reports: Customers inspect pre-rental
                    condition notes before booking and submit return condition photos upon handover.
                  </p>
                  <p>
                    3. Academic Demonstration: Demo online payments on BorrowBox simulate checkout
                    transactions without processing real bank cards.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    1. Account Security: Passwords are stored exclusively using salted bcrypt hashes.
                    Sessions use HTTP-only server cookies.
                  </p>
                  <p>
                    2. Order &amp; Contact Data: Name, email, phone number, and delivery address are
                    used solely to fulfill and track your rental bookings.
                  </p>
                  <p>
                    3. Return Photos: Condition report photos uploaded during equipment return are
                    visible only to you and BorrowBox administrators.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed right-5 bottom-5 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-semibold shadow-lg ${
            toast.type === 'error'
              ? 'border-red-200 bg-red-50 text-[#DC2626]'
              : 'border-[#E5E8F0] bg-white text-[#252A34]'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-[#DC2626]" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#299B68]" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
