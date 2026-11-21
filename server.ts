import 'dotenv/config';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import express, { type Request, type Response, type NextFunction } from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import {
  initDatabase,
  hasAnyAdmin,
  findUserByEmail,
  findUserByPhone,
  findUserById,
  createUser,
  updateUserPassword,
  updateUserProviderState,
  listCustomers,
  listProvidersAndApplicants,
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  listBundles,
  getBundleById,
  createBundle,
  updateBundle,
  deleteBundle,
  listOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  updateProviderOrderItemsStatus,
  listConditionReports,
  getConditionReportById,
  createConditionReport,
  reviewConditionReport,
  getReservedUnitsForRange,
  getCartForUser,
  saveCartForUser,
  getTokenSession,
  saveTokenSession,
  deleteTokenSession,
  type BundleRecord,
  type CartItemRecord,
  type ListingApprovalStatus,
  type OrderStatus,
  type PaymentMethod,
  type ProductCondition,
  type ProductRecord,
  type ProviderStatus,
  type ReportReviewStatus,
  type ReturnReportedCondition,
  type UserRecord,
  type UserRole,
} from './db.ts';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    role?: UserRole;
    cart?: CartItemRecord[];
    oauthState?: string;
    tokenKey?: string;
  }
}

interface AuthContext {
  userId: string | null;
  role: UserRole | null;
  tokenKey: string | null;
}

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

const VALID_ORDER_STATUSES: OrderStatus[] = [
  'Order Placed',
  'Confirmed',
  'Ready for Pickup',
  'Rented',
  'Returned',
  'Cancelled',
];

const VALID_PRODUCT_CONDITIONS: ProductCondition[] = [
  'Mint',
  'Good',
  'Fair',
  'Needs Maintenance',
];

const VALID_RETURN_CONDITIONS: ReturnReportedCondition[] = ['Mint', 'Good', 'Fair', 'Damaged'];
const VALID_REVIEW_STATUSES: ReportReviewStatus[] = [
  'Pending Review',
  'Reviewed - Cleared',
  'Damage Flagged',
];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function normalizePhone(countryCode: string, rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  const code = countryCode.startsWith('+') ? countryCode : `+${countryCode.replace(/\D/g, '')}`;
  return `${code}${digits}`;
}

function isValidPhoneDigits(rawPhone: string): boolean {
  const digits = rawPhone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

function isValidImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return false;
  }
  if (trimmed.startsWith('/src/assets/images/') || trimmed.startsWith('images/') || trimmed.startsWith('/images/')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isValidUploadedReportPhoto(photo: string): boolean {
  const trimmed = photo.trim();
  if (!trimmed || trimmed.length > 2_500_000) return false;
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return true;
  }
  return isValidImageUrl(trimmed);
}

function isValidProductImage(url: string): boolean {
  return isValidUploadedReportPhoto(url);
}

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function calculateRentalDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff + 1;
}

function validateDateRange(startDate: string, endDate: string): { valid: boolean; days: number; error?: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { valid: false, days: 0, error: 'Please select valid start and end dates.' };
  }
  const today = getTodayDateString();
  if (startDate < today) {
    return { valid: false, days: 0, error: 'Rental start date cannot be in the past.' };
  }
  if (endDate < startDate) {
    return { valid: false, days: 0, error: 'Rental end date cannot be earlier than the start date.' };
  }
  const days = calculateRentalDays(startDate, endDate);
  if (days <= 0 || days > 90) {
    return { valid: false, days: 0, error: 'Rental duration must be between 1 and 90 days.' };
  }
  return { valid: true, days };
}

function sanitizeUser(user: UserRecord) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    authProvider: user.authProvider,
    providerStatus: user.providerStatus || (user.role === 'provider' ? 'approved' : 'none'),
    providerProfile: user.providerProfile,
    createdAt: user.createdAt,
  };
}

function getAppBaseUrl(req: Request): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl && envUrl !== 'MY_APP_URL') {
    return envUrl.replace(/\/$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

async function resolveAuth(req: Request): Promise<AuthContext> {
  if (req.session?.userId) {
    const freshUser = await findUserById(req.session.userId);
    if (freshUser) {
      req.session.role = freshUser.role;
      return {
        userId: freshUser.id,
        role: freshUser.role,
        tokenKey: req.session.tokenKey ?? null,
      };
    }
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const tokenSession = await getTokenSession(token);
    if (tokenSession && tokenSession.userId) {
      const freshUser = await findUserById(tokenSession.userId);
      if (freshUser) {
        return {
          userId: freshUser.id,
          role: freshUser.role,
          tokenKey: tokenSession.token,
        };
      }
    }
  }
  return { userId: null, role: null, tokenKey: null };
}

async function establishSession(
  req: Request,
  user: UserRecord,
  rememberMe = true,
): Promise<string> {
  const guestCart = Array.isArray(req.session.cart) ? req.session.cart : [];
  if (guestCart.length > 0 && user.role !== 'admin') {
    const existingCart = await getCartForUser(user.id);
    const merged = [...existingCart];
    for (const item of guestCart) {
      const exists = merged.some(
        (m) =>
          m.productId === item.productId &&
          m.bundleId === item.bundleId &&
          m.startDate === item.startDate &&
          m.endDate === item.endDate,
      );
      if (!exists) merged.push(item);
    }
    await saveCartForUser(user.id, merged);
  }

  const token = crypto.randomBytes(24).toString('hex');
  const maxAgeMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  await saveTokenSession({
    token,
    userId: user.id,
    role: user.role,
    cart: [],
    expiresAt: Date.now() + maxAgeMs,
  });

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.tokenKey = token;
  req.session.cart = [];
  if (req.session.cookie) {
    req.session.cookie.maxAge = maxAgeMs;
  }
  await new Promise<void>((resolve) => req.session.save(() => resolve()));
  return token;
}

async function getActiveCart(req: Request, auth: AuthContext): Promise<CartItemRecord[]> {
  if (auth.userId) {
    return await getCartForUser(auth.userId);
  }
  const headerGuestId = req.headers['x-guest-cart-id'];
  if (typeof headerGuestId === 'string' && headerGuestId.startsWith('guest-')) {
    const tokenSess = await getTokenSession(headerGuestId);
    if (tokenSess) return tokenSess.cart;
  }
  return Array.isArray(req.session.cart) ? req.session.cart : [];
}

async function persistActiveCart(req: Request, auth: AuthContext, items: CartItemRecord[]): Promise<void> {
  if (auth.userId) {
    await saveCartForUser(auth.userId, items);
    return;
  }
  req.session.cart = items;
  await new Promise<void>((resolve) => req.session.save(() => resolve()));
  const headerGuestId = req.headers['x-guest-cart-id'];
  if (typeof headerGuestId === 'string' && headerGuestId.startsWith('guest-')) {
    await saveTokenSession({
      token: headerGuestId,
      userId: '',
      role: 'customer',
      cart: items,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
  }
}

function enrichBundle(bundle: BundleRecord, productMap: Map<string, ProductRecord>) {
  const includedProducts = bundle.productIds
    .map((pid) => productMap.get(pid))
    .filter((p): p is ProductRecord => Boolean(p && p.approvalStatus === 'approved'));
  const individualTotalPerDay = includedProducts.reduce((sum, p) => sum + p.pricePerDay, 0);
  const available =
    includedProducts.length === bundle.productIds.length &&
    includedProducts.length > 0 &&
    includedProducts.every((p) => p.available && p.totalUnits > 0);
  const availableUnits =
    includedProducts.length > 0 ? Math.min(...includedProducts.map((p) => p.totalUnits)) : 0;

  return {
    ...bundle,
    products: includedProducts,
    individualTotalPerDay,
    savingsPerDay: Math.max(0, individualTotalPerDay - bundle.bundlePricePerDay),
    available,
    availableUnits,
  };
}

async function checkBundleAvailability(
  bundle: BundleRecord,
  productMap: Map<string, ProductRecord>,
  startDate: string,
  endDate: string,
  qty: number,
) {
  const included = bundle.productIds
    .map((pid) => productMap.get(pid))
    .filter((p): p is ProductRecord => Boolean(p));

  if (included.length === 0 || included.length !== bundle.productIds.length) {
    return {
      available: false,
      availableUnits: 0,
      reason: 'One or more products in this bundle are no longer listed.',
    };
  }

  let minUnits = Infinity;
  let limitingProduct = '';
  for (const prod of included) {
    if (!prod.available) {
      return {
        available: false,
        availableUnits: 0,
        reason: `${prod.name} (included in this kit) is currently marked unavailable.`,
      };
    }
    const reserved = await getReservedUnitsForRange(prod.id, startDate, endDate);
    const free = Math.max(0, prod.totalUnits - reserved);
    if (free < minUnits) {
      minUnits = free;
      limitingProduct = prod.name;
    }
  }

  const availableUnits = Number.isFinite(minUnits) ? minUnits : 0;
  const available = availableUnits >= qty;
  return {
    available,
    availableUnits,
    reason: available
      ? undefined
      : availableUnits === 0
        ? `${limitingProduct} in this bundle is fully booked for these dates.`
        : `Only ${availableUnits} kit(s) available for these dates (limited by ${limitingProduct}).`,
  };
}

async function buildEnrichedCart(items: CartItemRecord[]) {
  const [products, bundles] = await Promise.all([listProducts(), listBundles()]);
  const productMap = new Map(products.map((p) => [p.id, p]));
  const bundleMap = new Map(bundles.map((b) => [b.id, b]));
  const enriched = [];
  let subtotal = 0;

  for (const item of items) {
    const days = Math.max(1, calculateRentalDays(item.startDate, item.endDate));

    if (item.bundleId) {
      const bundle = bundleMap.get(item.bundleId);
      if (!bundle) continue;
      const eb = enrichBundle(bundle, productMap);
      const lineTotal = bundle.bundlePricePerDay * days * item.quantity;
      subtotal += lineTotal;
      enriched.push({
        id: item.id,
        isBundle: true,
        productId: bundle.id,
        bundleId: bundle.id,
        includedProductNames: eb.products.map((p) => p.name),
        productName: `${bundle.name} (Bundle)`,
        productCode: bundle.code,
        productImage: bundle.image,
        categoryName: 'Smart Rental Bundle',
        pricePerDay: bundle.bundlePricePerDay,
        startDate: item.startDate,
        endDate: item.endDate,
        days,
        quantity: item.quantity,
        totalUnits: eb.availableUnits,
        lineTotal,
      });
      continue;
    }

    if (item.productId) {
      const product = productMap.get(item.productId);
      if (!product) continue;
      const lineTotal = product.pricePerDay * days * item.quantity;
      subtotal += lineTotal;
      enriched.push({
        id: item.id,
        isBundle: false,
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        productImage: product.image,
        categoryName: product.categoryName,
        pricePerDay: product.pricePerDay,
        startDate: item.startDate,
        endDate: item.endDate,
        days,
        quantity: item.quantity,
        totalUnits: product.totalUnits,
        lineTotal,
      });
    }
  }

  const deliveryFee = enriched.length === 0 ? 0 : subtotal >= 1000 ? 0 : 60;
  return {
    items: enriched,
    subtotal,
    deliveryFee,
    totalAmount: subtotal + deliveryFee,
  };
}

async function startServer() {
  const dbInfo = await initDatabase();

  const app = express();
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '12mb' }));
  app.use(cookieParser());

  app.use((req: Request, res: Response, next: NextFunction) => {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    const sessMiddleware = session({
      name: 'borrowbox.sid',
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      proxy: true,
      cookie: {
        httpOnly: true,
        secure: Boolean(isHttps),
        sameSite: isHttps ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    });
    sessMiddleware(req, res, next);
  });

  // CSRF & Origin guard for state-changing API routes
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }
    const requestedWith = req.headers['x-requested-with'];
    const origin = req.headers.origin;
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
    if (requestedWith === 'XMLHttpRequest') {
      return next();
    }
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost === host) return next();
      } catch {
        // reject below
      }
    }
    return res.status(403).json({ error: 'Invalid request origin.' });
  });

  async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const auth = await resolveAuth(req);
    if (!auth.userId) {
      return res.status(401).json({ error: 'Please log in to continue.' });
    }
    (req as Request & { auth: AuthContext }).auth = auth;
    next();
  }

  async function requireProvider(req: Request, res: Response, next: NextFunction) {
    const auth = await resolveAuth(req);
    if (!auth.userId || (auth.role !== 'provider' && auth.role !== 'admin')) {
      return res.status(403).json({ error: 'Approved rental provider access required.' });
    }
    (req as Request & { auth: AuthContext }).auth = auth;
    next();
  }

  async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    const auth = await resolveAuth(req);
    if (!auth.userId || auth.role !== 'admin') {
      return res.status(403).json({ error: 'Administrator access required.' });
    }
    (req as Request & { auth: AuthContext }).auth = auth;
    next();
  }

  // -------------------- AUTH ROUTES --------------------

  app.get('/api/auth/me', async (req: Request, res: Response) => {
    const auth = await resolveAuth(req);
    const user = auth.userId ? await findUserById(auth.userId) : null;
    const cart = await getActiveCart(req, auth);
    const googleConfigured = Boolean(
      process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
    );
    res.json({
      user: user ? sanitizeUser(user) : null,
      cartCount: cart.reduce((sum, i) => sum + i.quantity, 0),
      integrations: {
        googleConfigured,
        dbMode: dbInfo.mode,
      },
    });
  });

  app.post('/api/auth/signup', async (req: Request, res: Response) => {
    const {
      fullName = '',
      email = '',
      countryCode = '+91',
      phone = '',
      password = '',
      confirmPassword = '',
      termsAccepted = false,
    } = req.body ?? {};

    if (typeof fullName !== 'string' || fullName.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' });
    }
    if (typeof email !== 'string' || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (typeof phone !== 'string' || !isValidPhoneDigits(phone)) {
      return res.status(400).json({ error: 'Please enter a valid phone number (7–15 digits).' });
    }
    if (typeof password !== 'string' || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long and include both letters and numbers.',
      });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }
    if (!termsAccepted) {
      return res.status(400).json({ error: 'Please accept the Terms and Conditions to create an account.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = normalizePhone(String(countryCode), phone);

    const existingEmail = await findUserByEmail(normalizedEmail);
    if (existingEmail) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }
    const existingPhone = await findUserByPhone(normalizedPhone);
    if (existingPhone) {
      return res.status(409).json({ error: 'An account with this phone number already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({
      fullName: fullName.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash,
      role: 'customer',
      authProvider: 'email',
    });

    const token = await establishSession(req, user, true);
    res.status(201).json({ user: sanitizeUser(user), token });
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { email = '', password = '', rememberMe = true } = req.body ?? {};
    if (typeof email !== 'string' || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({ error: 'Password cannot be empty.' });
    }

    const user = await findUserByEmail(email);
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({
        error: 'Administrator accounts must sign in through the separate Admin Login page.',
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = await establishSession(req, user, Boolean(rememberMe));
    res.json({ user: sanitizeUser(user), token });
  });

  app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    const { email = '', newPassword = '' } = req.body ?? {};
    if (typeof email !== 'string' || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    const user = await findUserByEmail(email);
    if (newPassword) {
      if (
        typeof newPassword !== 'string' ||
        newPassword.length < 8 ||
        !/[A-Za-z]/.test(newPassword) ||
        !/\d/.test(newPassword)
      ) {
        return res.status(400).json({
          error: 'New password must be at least 8 characters with letters and numbers.',
        });
      }
      if (user && user.role !== 'admin') {
        const hash = await bcrypt.hash(newPassword, 10);
        await updateUserPassword(user.id, hash);
      }
      return res.json({
        message: 'If an account matches this email, the password has been updated for this demonstration.',
      });
    }
    return res.json({
      message:
        'Password reset verified in demo mode. You can now set a new password below or check your configured mail provider.',
      canResetDemo: Boolean(user && user.role !== 'admin'),
    });
  });

  app.get('/api/auth/google/status', (req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const configured = Boolean(clientId && clientSecret);
    const redirectUri = `${getAppBaseUrl(req)}/auth/google/callback`;
    res.json({ configured, redirectUri });
  });

  app.get('/api/auth/google/url', async (req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      return res.status(503).json({
        configured: false,
        redirectUri: `${getAppBaseUrl(req)}/auth/google/callback`,
        error:
          'Google OAuth is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment secrets.',
      });
    }

    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauthState = state;
    await new Promise<void>((resolve) => req.session.save(() => resolve()));

    const redirectUri = `${getAppBaseUrl(req)}/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });

    res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  });

  const handleGoogleCallback = async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

    if (!code || !clientId || !clientSecret) {
      return res.status(400).send('<p>Google OAuth callback missing authorization code or server config.</p>');
    }

    try {
      const redirectUri = `${getAppBaseUrl(req)}/auth/google/callback`;
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
      });
      if (!tokenRes.ok) {
        throw new Error('Failed to exchange authorization code with Google.');
      }
      const tokenJson = (await tokenRes.json()) as { access_token?: string };
      if (!tokenJson.access_token) {
        throw new Error('No access token returned from Google.');
      }

      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      if (!profileRes.ok) {
        throw new Error('Unable to fetch Google user profile.');
      }
      const profile = (await profileRes.json()) as {
        id?: string;
        email?: string;
        name?: string;
      };
      if (!profile.email) {
        throw new Error('Google profile did not include an email address.');
      }

      let user = await findUserByEmail(profile.email);
      if (!user) {
        user = await createUser({
          fullName: profile.name || profile.email.split('@')[0],
          email: profile.email,
          phone: '',
          passwordHash: null,
          role: 'customer',
          authProvider: 'google',
          googleId: profile.id,
        });
      }

      const sessionToken = await establishSession(req, user, true);

      res.send(`<!doctype html>
<html>
  <body style="font-family: sans-serif; padding: 24px; color: #252A34;">
    <p>Authentication successful. Completing sign in...</p>
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: ${JSON.stringify(sessionToken)} }, '*');
        window.close();
      } else {
        window.location.href = '/';
      }
    </script>
  </body>
</html>`);
    } catch (err) {
      res
        .status(500)
        .send(
          `<p>Google sign-in failed: ${err instanceof Error ? err.message : 'Unexpected error'}</p>`,
        );
    }
  };

  app.get('/auth/google/callback', handleGoogleCallback);
  app.get('/auth/google/callback/', handleGoogleCallback);

  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    const auth = await resolveAuth(req);
    if (auth.tokenKey) {
      await deleteTokenSession(auth.tokenKey);
    }
    if (req.session) {
      await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
    }
    res.clearCookie('borrowbox.sid');
    res.json({ ok: true });
  });

  // -------------------- ADMIN AUTH ROUTES --------------------

  app.get('/api/admin/status', async (_req: Request, res: Response) => {
    const initialized = await hasAnyAdmin();
    const envConfigured = Boolean(
      process.env.ADMIN_EMAIL?.trim() && process.env.ADMIN_PASSWORD?.trim(),
    );
    res.json({ initialized, envConfigured });
  });

  app.post('/api/admin/bootstrap', async (req: Request, res: Response) => {
    if (process.env.ADMIN_PASSWORD?.trim()) {
      return res.status(403).json({
        error: 'Initial admin credentials are configured via environment variables.',
      });
    }
    const alreadyExists = await hasAnyAdmin();
    if (alreadyExists) {
      return res.status(409).json({
        error: 'An administrator account has already been set up. Please sign in normally.',
      });
    }

    const { email = '', password = '', fullName = 'BorrowBox Admin' } = req.body ?? {};
    if (typeof email !== 'string' || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Please provide a valid administrator email.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Administrator password must be at least 8 characters.' });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'That email is already registered to another account.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await createUser({
      fullName: typeof fullName === 'string' && fullName.trim() ? fullName.trim() : 'BorrowBox Admin',
      email: email.trim().toLowerCase(),
      phone: '+910000000000',
      passwordHash,
      role: 'admin',
      authProvider: 'email',
    });

    const token = await establishSession(req, admin, true);
    res.status(201).json({ user: sanitizeUser(admin), token });
  });

  app.post('/api/admin/login', async (req: Request, res: Response) => {
    const { email = '', password = '' } = req.body ?? {};
    if (typeof email !== 'string' || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid admin email address.' });
    }
    if (typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({ error: 'Please enter your administrator password.' });
    }

    const user = await findUserByEmail(email);
    if (!user || user.role !== 'admin' || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid administrator credentials.' });
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return res.status(401).json({ error: 'Invalid administrator credentials.' });
    }

    const token = await establishSession(req, user, false);
    res.json({ user: sanitizeUser(user), token });
  });

  // -------------------- CATALOGUE, BUNDLES & AVAILABILITY --------------------

  app.get('/api/categories', async (_req: Request, res: Response) => {
    const [categories, products] = await Promise.all([
      listCategories(),
      listProducts({ onlyApproved: true }),
    ]);
    const result = categories.map((cat) => ({
      ...cat,
      productCount: products.filter((p) => p.categoryId === cat.id).length,
    }));
    res.json({ categories: result });
  });

  app.get('/api/products', async (req: Request, res: Response) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim().toLowerCase() : '';
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'newest';
    const featuredOnly = req.query.featured === 'true';

    let products = await listProducts({ onlyApproved: true });

    if (featuredOnly) {
      products = products.filter((p) => p.featured);
    }

    if (category && category !== 'all') {
      products = products.filter(
        (p) =>
          p.categoryId.toLowerCase() === category ||
          p.categoryName.toLowerCase() === category ||
          p.categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-') === category,
      );
    }

    if (search) {
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.code.toLowerCase().includes(search) ||
          p.categoryName.toLowerCase().includes(search) ||
          p.description.toLowerCase().includes(search) ||
          p.providerName.toLowerCase().includes(search) ||
          p.providerCity.toLowerCase().includes(search),
      );
    }

    if (sort === 'price_asc') {
      products.sort((a, b) => a.pricePerDay - b.pricePerDay);
    } else if (sort === 'price_desc') {
      products.sort((a, b) => b.pricePerDay - a.pricePerDay);
    } else {
      products.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    res.json({ products });
  });

  app.get('/api/products/:id', async (req: Request, res: Response) => {
    const product = await getProductById(String(req.params.id));
    if (!product || product.approvalStatus !== 'approved') {
      return res.status(404).json({ error: 'Product not found.' });
    }
    res.json({ product });
  });

  app.post('/api/products/:id/check-availability', async (req: Request, res: Response) => {
    const product = await getProductById(String(req.params.id));
    if (!product || product.approvalStatus !== 'approved') {
      return res.status(404).json({ error: 'Product not found.' });
    }
    const { startDate = '', endDate = '', quantity = 1 } = req.body ?? {};
    const dateCheck = validateDateRange(String(startDate), String(endDate));
    if (!dateCheck.valid) {
      return res.status(400).json({ available: false, error: dateCheck.error });
    }

    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    if (!product.available) {
      return res.json({
        available: false,
        availableUnits: 0,
        totalUnits: product.totalUnits,
        days: dateCheck.days,
        totalPrice: product.pricePerDay * dateCheck.days * qty,
        reason: 'This item is currently marked unavailable by the provider.',
      });
    }

    const reserved = await getReservedUnitsForRange(product.id, String(startDate), String(endDate));
    const availableUnits = Math.max(0, product.totalUnits - reserved);
    const available = availableUnits >= qty;

    res.json({
      available,
      availableUnits,
      totalUnits: product.totalUnits,
      days: dateCheck.days,
      totalPrice: product.pricePerDay * dateCheck.days * qty,
      reason: available
        ? undefined
        : availableUnits === 0
          ? 'All units are already reserved for the selected rental dates.'
          : `Only ${availableUnits} unit(s) available for those dates.`,
    });
  });

  app.get('/api/availability', async (req: Request, res: Response) => {
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : '';
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : '';

    const dateCheck = validateDateRange(startDate, endDate);
    if (!dateCheck.valid) {
      return res.status(400).json({ error: dateCheck.error });
    }

    const [products, bundles] = await Promise.all([
      listProducts({ onlyApproved: true }),
      listBundles(),
    ]);

    const availableUnitsByProductId: Record<string, number> = {};
    await Promise.all(
      products.map(async (prod) => {
        if (!prod.available || prod.totalUnits <= 0) {
          availableUnitsByProductId[prod.id] = 0;
          return;
        }
        const reserved = await getReservedUnitsForRange(prod.id, startDate, endDate);
        availableUnitsByProductId[prod.id] = Math.max(0, prod.totalUnits - reserved);
      }),
    );

    const productMap = new Map(products.map((p) => [p.id, p]));
    const availableUnitsByBundleId: Record<string, number> = {};
    for (const bundle of bundles) {
      const included = bundle.productIds
        .map((pid) => productMap.get(pid))
        .filter((p): p is ProductRecord => Boolean(p && p.approvalStatus === 'approved'));
      if (included.length === 0 || included.length !== bundle.productIds.length) {
        availableUnitsByBundleId[bundle.id] = 0;
        continue;
      }
      const minFree = Math.min(
        ...included.map((prod) => availableUnitsByProductId[prod.id] ?? 0),
      );
      availableUnitsByBundleId[bundle.id] = Number.isFinite(minFree) ? minFree : 0;
    }

    res.json({
      startDate,
      endDate,
      days: dateCheck.days,
      availableUnitsByProductId,
      availableUnitsByBundleId,
    });
  });

  app.get('/api/bundles', async (req: Request, res: Response) => {
    const [bundles, products] = await Promise.all([
      listBundles(),
      listProducts({ onlyApproved: true }),
    ]);
    const productMap = new Map(products.map((p) => [p.id, p]));
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

    let enriched = bundles.map((b) => enrichBundle(b, productMap));
    if (search) {
      enriched = enriched.filter(
        (b) =>
          b.name.toLowerCase().includes(search) ||
          b.code.toLowerCase().includes(search) ||
          b.description.toLowerCase().includes(search) ||
          b.products.some((p) => p.name.toLowerCase().includes(search)),
      );
    }

    res.json({ bundles: enriched });
  });

  app.post('/api/bundles/:id/check-availability', async (req: Request, res: Response) => {
    const bundle = await getBundleById(String(req.params.id));
    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found.' });
    }
    const { startDate = '', endDate = '', quantity = 1 } = req.body ?? {};
    const dateCheck = validateDateRange(String(startDate), String(endDate));
    if (!dateCheck.valid) {
      return res.status(400).json({ available: false, error: dateCheck.error });
    }
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    const products = await listProducts({ onlyApproved: true });
    const productMap = new Map(products.map((p) => [p.id, p]));
    const check = await checkBundleAvailability(bundle, productMap, String(startDate), String(endDate), qty);

    res.json({
      available: check.available,
      availableUnits: check.availableUnits,
      days: dateCheck.days,
      totalPrice: bundle.bundlePricePerDay * dateCheck.days * qty,
      reason: check.reason,
    });
  });

  // -------------------- CART ROUTES --------------------

  app.get('/api/cart', async (req: Request, res: Response) => {
    const auth = await resolveAuth(req);
    const items = await getActiveCart(req, auth);
    const enriched = await buildEnrichedCart(items);
    res.json(enriched);
  });

  app.post('/api/cart', async (req: Request, res: Response) => {
    const auth = await resolveAuth(req);
    const { productId = '', bundleId = '', startDate = '', endDate = '', quantity = 1 } = req.body ?? {};

    const dateCheck = validateDateRange(String(startDate), String(endDate));
    if (!dateCheck.valid) {
      return res.status(400).json({ error: dateCheck.error });
    }
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    const cart = await getActiveCart(req, auth);

    if (bundleId) {
      const bundle = await getBundleById(String(bundleId));
      if (!bundle) {
        return res.status(404).json({ error: 'Selected rental bundle was not found.' });
      }
      const products = await listProducts();
      const productMap = new Map(products.map((p) => [p.id, p]));
      const existingIdx = cart.findIndex(
        (i) => i.bundleId === bundle.id && i.startDate === startDate && i.endDate === endDate,
      );
      const targetQty = existingIdx !== -1 ? cart[existingIdx].quantity + qty : qty;
      const check = await checkBundleAvailability(bundle, productMap, String(startDate), String(endDate), targetQty);
      if (!check.available) {
        return res.status(409).json({ error: check.reason || 'Bundle unavailable for those dates.' });
      }
      if (existingIdx !== -1) {
        cart[existingIdx] = { ...cart[existingIdx], quantity: targetQty };
      } else {
        cart.push({
          id: `ci-${crypto.randomUUID().slice(0, 8)}`,
          bundleId: bundle.id,
          startDate: String(startDate),
          endDate: String(endDate),
          quantity: qty,
        });
      }
      await persistActiveCart(req, auth, cart);
      const enriched = await buildEnrichedCart(cart);
      return res.status(201).json(enriched);
    }

    const product = await getProductById(String(productId));
    if (!product || product.approvalStatus !== 'approved') {
      return res.status(404).json({ error: 'Selected product was not found.' });
    }
    if (!product.available) {
      return res.status(400).json({ error: 'This product is currently unavailable for rent.' });
    }

    const reserved = await getReservedUnitsForRange(product.id, String(startDate), String(endDate));
    const availableUnits = Math.max(0, product.totalUnits - reserved);
    if (qty > availableUnits) {
      return res.status(409).json({
        error:
          availableUnits === 0
            ? 'This item is fully booked for your selected dates. Try different dates.'
            : `Only ${availableUnits} unit(s) available for those dates.`,
      });
    }

    const existingIdx = cart.findIndex(
      (i) => i.productId === product.id && i.startDate === startDate && i.endDate === endDate,
    );

    if (existingIdx !== -1) {
      const nextQty = cart[existingIdx].quantity + qty;
      if (nextQty > availableUnits) {
        return res.status(409).json({
          error: `Only ${availableUnits} unit(s) available for those dates.`,
        });
      }
      cart[existingIdx] = { ...cart[existingIdx], quantity: nextQty };
    } else {
      cart.push({
        id: `ci-${crypto.randomUUID().slice(0, 8)}`,
        productId: product.id,
        startDate: String(startDate),
        endDate: String(endDate),
        quantity: qty,
      });
    }

    await persistActiveCart(req, auth, cart);
    const enriched = await buildEnrichedCart(cart);
    res.status(201).json(enriched);
  });

  app.patch('/api/cart/:itemId', async (req: Request, res: Response) => {
    const auth = await resolveAuth(req);
    const cart = await getActiveCart(req, auth);
    const idx = cart.findIndex((i) => i.id === req.params.itemId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Cart item not found.' });
    }

    const current = cart[idx];
    const nextStart = typeof req.body?.startDate === 'string' ? req.body.startDate : current.startDate;
    const nextEnd = typeof req.body?.endDate === 'string' ? req.body.endDate : current.endDate;
    const nextQty =
      req.body?.quantity !== undefined
        ? Math.max(1, Math.floor(Number(req.body.quantity) || 1))
        : current.quantity;

    const dateCheck = validateDateRange(nextStart, nextEnd);
    if (!dateCheck.valid) {
      return res.status(400).json({ error: dateCheck.error });
    }

    if (current.bundleId) {
      const bundle = await getBundleById(current.bundleId);
      if (!bundle) {
        return res.status(400).json({ error: 'This bundle is no longer available.' });
      }
      const products = await listProducts();
      const productMap = new Map(products.map((p) => [p.id, p]));
      const check = await checkBundleAvailability(bundle, productMap, nextStart, nextEnd, nextQty);
      if (!check.available) {
        return res.status(409).json({ error: check.reason || 'Bundle unavailable for those dates.' });
      }
    } else if (current.productId) {
      const product = await getProductById(current.productId);
      if (!product || !product.available) {
        return res.status(400).json({ error: 'This product is no longer available.' });
      }
      const reserved = await getReservedUnitsForRange(product.id, nextStart, nextEnd);
      const availableUnits = Math.max(0, product.totalUnits - reserved);
      if (nextQty > availableUnits) {
        return res.status(409).json({
          error:
            availableUnits === 0
              ? 'All units are reserved for the selected dates.'
              : `Only ${availableUnits} unit(s) available for those dates.`,
        });
      }
    }

    cart[idx] = { ...current, startDate: nextStart, endDate: nextEnd, quantity: nextQty };
    await persistActiveCart(req, auth, cart);
    const enriched = await buildEnrichedCart(cart);
    res.json(enriched);
  });

  app.delete('/api/cart/:itemId', async (req: Request, res: Response) => {
    const auth = await resolveAuth(req);
    const cart = await getActiveCart(req, auth);
    const next = cart.filter((i) => i.id !== req.params.itemId);
    await persistActiveCart(req, auth, next);
    const enriched = await buildEnrichedCart(next);
    res.json(enriched);
  });

  app.delete('/api/cart', async (req: Request, res: Response) => {
    const auth = await resolveAuth(req);
    await persistActiveCart(req, auth, []);
    res.json({ items: [], subtotal: 0, deliveryFee: 0, totalAmount: 0 });
  });

  // -------------------- CUSTOMER ORDERS & CONDITION REPORTS --------------------

  app.get('/api/orders/my', requireAuth, async (req: Request, res: Response) => {
    const auth = (req as Request & { auth: AuthContext }).auth;
    const [orders, reports] = await Promise.all([
      listOrders(auth.userId!),
      listConditionReports(auth.userId!),
    ]);
    res.json({ orders, conditionReports: reports });
  });

  app.post('/api/orders', requireAuth, async (req: Request, res: Response) => {
    const auth = (req as Request & { auth: AuthContext }).auth;
    const user = await findUserById(auth.userId!);
    if (!user) {
      return res.status(401).json({ error: 'User account not found.' });
    }

    const {
      fullName = '',
      email = '',
      phone = '',
      address = '',
      city = '',
      pinCode = '',
      paymentMethod = '',
    } = req.body ?? {};

    if (typeof fullName !== 'string' || fullName.trim().length < 2) {
      return res.status(400).json({ error: 'Full name is required.' });
    }
    if (typeof email !== 'string' || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (typeof phone !== 'string' || !isValidPhoneDigits(phone)) {
      return res.status(400).json({ error: 'Please provide a valid phone number.' });
    }
    if (typeof address !== 'string' || address.trim().length < 8) {
      return res.status(400).json({ error: 'Please enter your complete delivery/pickup address.' });
    }
    if (typeof city !== 'string' || city.trim().length < 2) {
      return res.status(400).json({ error: 'City is required.' });
    }
    if (typeof pinCode !== 'string' || !/^\d{5,6}$/.test(pinCode.trim())) {
      return res.status(400).json({ error: 'Please enter a valid 5 or 6 digit PIN code.' });
    }
    if (paymentMethod !== 'cod' && paymentMethod !== 'demo_online') {
      return res.status(400).json({ error: 'Please select a valid payment method.' });
    }

    const cartItems = await getActiveCart(req, auth);
    if (cartItems.length === 0) {
      return res.status(400).json({ error: 'Your rental cart is empty.' });
    }

    const allProducts = await listProducts({ onlyApproved: true });
    const productMap = new Map(allProducts.map((p) => [p.id, p]));
    const orderItems = [];
    const touchedProductIds = new Set<string>();
    let subtotal = 0;

    for (const ci of cartItems) {
      const dateCheck = validateDateRange(ci.startDate, ci.endDate);
      if (!dateCheck.valid) {
        return res.status(400).json({ error: dateCheck.error || 'Invalid rental dates in cart.' });
      }

      if (ci.bundleId) {
        const bundle = await getBundleById(ci.bundleId);
        if (!bundle) {
          return res.status(409).json({ error: 'A bundle in your cart is no longer available.' });
        }
        const check = await checkBundleAvailability(bundle, productMap, ci.startDate, ci.endDate, ci.quantity);
        if (!check.available) {
          return res.status(409).json({ error: check.reason || `${bundle.name} is unavailable.` });
        }
        const includedProducts = bundle.productIds
          .map((pid) => productMap.get(pid))
          .filter((p): p is ProductRecord => Boolean(p));
        const lineTotal = bundle.bundlePricePerDay * dateCheck.days * ci.quantity;
        subtotal += lineTotal;
        for (const p of includedProducts) touchedProductIds.add(p.id);
        orderItems.push({
          productId: bundle.id,
          bundleId: bundle.id,
          includedProductIds: includedProducts.map((p) => p.id),
          includedProductNames: includedProducts.map((p) => p.name),
          providerId: includedProducts[0]?.providerId || 'provider-borrowbox',
          providerName: includedProducts[0]?.providerName || 'BorrowBox Verified Hub',
          itemStatus: 'Order Placed' as OrderStatus,
          productName: `${bundle.name} (Bundle)`,
          productCode: bundle.code,
          productImage: bundle.image,
          categoryName: 'Smart Rental Bundle',
          pricePerDay: bundle.bundlePricePerDay,
          startDate: ci.startDate,
          endDate: ci.endDate,
          days: dateCheck.days,
          quantity: ci.quantity,
          lineTotal,
        });
        continue;
      }

      const product = ci.productId ? productMap.get(ci.productId) : undefined;
      if (!product || !product.available || product.approvalStatus !== 'approved') {
        return res.status(409).json({
          error: `${product?.name || 'One of your items'} is no longer available.`,
        });
      }
      const reserved = await getReservedUnitsForRange(product.id, ci.startDate, ci.endDate);
      const availableUnits = Math.max(0, product.totalUnits - reserved);
      if (ci.quantity > availableUnits) {
        return res.status(409).json({
          error: `${product.name} only has ${availableUnits} unit(s) available for ${ci.startDate} to ${ci.endDate}.`,
        });
      }

      const lineTotal = product.pricePerDay * dateCheck.days * ci.quantity;
      subtotal += lineTotal;
      touchedProductIds.add(product.id);
      orderItems.push({
        productId: product.id,
        providerId: product.providerId,
        providerName: product.providerName,
        itemStatus: 'Order Placed' as OrderStatus,
        productName: product.name,
        productCode: product.code,
        productImage: product.image,
        categoryName: product.categoryName,
        pricePerDay: product.pricePerDay,
        startDate: ci.startDate,
        endDate: ci.endDate,
        days: dateCheck.days,
        quantity: ci.quantity,
        lineTotal,
      });
    }

    const deliveryFee = subtotal >= 1000 ? 0 : 60;
    const totalAmount = subtotal + deliveryFee;
    const isDemoOnline = paymentMethod === 'demo_online';
    const transactionRef = isDemoOnline
      ? `DEMO-TXN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
      : null;

    const order = await createOrder({
      userId: user.id,
      customerName: fullName.trim(),
      customerEmail: email.trim().toLowerCase(),
      customerPhone: phone.trim(),
      address: address.trim(),
      city: city.trim(),
      pinCode: pinCode.trim(),
      items: orderItems,
      subtotal,
      deliveryFee,
      totalAmount,
      paymentMethod: paymentMethod as PaymentMethod,
      paymentStatus: isDemoOnline ? 'Paid (Demo)' : 'Pending',
      transactionRef,
      orderStatus: 'Order Placed',
    });

    await persistActiveCart(req, auth, []);

    const today = getTodayDateString();
    for (const pid of touchedProductIds) {
      const product = await getProductById(pid);
      if (product) {
        const reservedToday = await getReservedUnitsForRange(product.id, today, today);
        if (reservedToday >= product.totalUnits && product.available) {
          await updateProduct(product.id, { available: false });
        }
      }
    }

    res.status(201).json({ order });
  });

  app.get('/api/condition-reports/my', requireAuth, async (req: Request, res: Response) => {
    const auth = (req as Request & { auth: AuthContext }).auth;
    const reports = await listConditionReports(auth.userId!);
    res.json({ reports });
  });

  app.post('/api/condition-reports', requireAuth, async (req: Request, res: Response) => {
    const auth = (req as Request & { auth: AuthContext }).auth;
    const user = await findUserById(auth.userId!);
    if (!user) {
      return res.status(401).json({ error: 'Account not found.' });
    }

    const {
      orderId = '',
      productId = '',
      reportedCondition = '',
      customerNotes = '',
      photos = [],
    } = req.body ?? {};

    const order = await getOrderById(String(orderId));
    if (!order || order.userId !== user.id) {
      return res.status(404).json({ error: 'Order not found for your account.' });
    }
    if (order.orderStatus === 'Cancelled') {
      return res.status(400).json({ error: 'Condition reports cannot be submitted for cancelled orders.' });
    }

    const matchingProductIds = new Set<string>();
    for (const item of order.items) {
      if (item.includedProductIds && item.includedProductIds.length > 0) {
        for (const pid of item.includedProductIds) matchingProductIds.add(pid);
      } else {
        matchingProductIds.add(item.productId);
      }
    }

    if (!matchingProductIds.has(String(productId))) {
      return res.status(400).json({ error: 'Selected product does not belong to this order.' });
    }

    const product = await getProductById(String(productId));
    if (!product) {
      return res.status(404).json({ error: 'Product record not found.' });
    }

    if (!VALID_RETURN_CONDITIONS.includes(reportedCondition)) {
      return res.status(400).json({ error: 'Please select a valid return condition.' });
    }
    if (typeof customerNotes !== 'string' || customerNotes.trim().length < 5) {
      return res.status(400).json({ error: 'Please add return condition notes (at least 5 characters).' });
    }
    if (!Array.isArray(photos) || photos.length > 4) {
      return res.status(400).json({ error: 'You may attach up to 4 photos.' });
    }

    const safePhotos: string[] = [];
    for (const ph of photos) {
      if (typeof ph !== 'string' || !isValidUploadedReportPhoto(ph)) {
        return res.status(400).json({
          error: 'Each photo must be a valid PNG, JPEG, or WebP image (under 2MB).',
        });
      }
      safePhotos.push(ph.trim());
    }

    const report = await createConditionReport({
      orderId: order.id,
      orderNumber: order.orderNumber,
      productId: product.id,
      productName: product.name,
      providerId: product.providerId,
      providerName: product.providerName,
      userId: user.id,
      customerName: user.fullName,
      reportedCondition: reportedCondition as ReturnReportedCondition,
      customerNotes,
      photos: safePhotos,
    });

    res.status(201).json({ report });
  });

  // -------------------- PROVIDER APPLICATION & MARKETPLACE ROUTES --------------------

  app.post('/api/provider/apply', requireAuth, async (req: Request, res: Response) => {
    const auth = (req as Request & { auth: AuthContext }).auth;
    const user = await findUserById(auth.userId!);
    if (!user) {
      return res.status(401).json({ error: 'Account not found.' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Administrators cannot apply as rental providers.' });
    }
    if (user.role === 'provider' && user.providerStatus === 'approved') {
      return res.status(400).json({ error: 'Your account is already an approved rental provider.' });
    }

    const { businessName = '', city = '', bio = '', contactPhone = '' } = req.body ?? {};
    if (typeof businessName !== 'string' || businessName.trim().length < 2) {
      return res.status(400).json({ error: 'Store or provider name must be at least 2 characters.' });
    }
    if (typeof city !== 'string' || city.trim().length < 2) {
      return res.status(400).json({ error: 'City or pickup hub location is required.' });
    }
    if (typeof bio !== 'string' || bio.trim().length < 10) {
      return res.status(400).json({ error: 'Please write a short provider description (at least 10 characters).' });
    }
    const phoneValue =
      typeof contactPhone === 'string' && contactPhone.trim() ? contactPhone.trim() : user.phone;
    if (!phoneValue || !isValidPhoneDigits(phoneValue)) {
      return res.status(400).json({ error: 'Please provide a valid contact phone number.' });
    }

    const updated = await updateUserProviderState(user.id, {
      providerStatus: 'pending',
      providerProfile: {
        businessName: businessName.trim(),
        city: city.trim(),
        bio: bio.trim(),
        contactPhone: phoneValue,
        appliedAt: new Date().toISOString(),
        reviewedAt: null,
        reviewNote: '',
      },
    });

    res.status(201).json({ user: updated ? sanitizeUser(updated) : null });
  });

  app.put('/api/provider/profile', requireProvider, async (req: Request, res: Response) => {
    const auth = (req as Request & { auth: AuthContext }).auth;
    const user = await findUserById(auth.userId!);
    if (!user) return res.status(401).json({ error: 'Account not found.' });

    const { businessName = '', city = '', bio = '', contactPhone = '' } = req.body ?? {};
    if (typeof businessName !== 'string' || businessName.trim().length < 2) {
      return res.status(400).json({ error: 'Store or provider name must be at least 2 characters.' });
    }
    if (typeof city !== 'string' || city.trim().length < 2) {
      return res.status(400).json({ error: 'City or pickup hub is required.' });
    }
    if (typeof bio !== 'string' || bio.trim().length < 10) {
      return res.status(400).json({ error: 'Provider bio must be at least 10 characters.' });
    }
    if (typeof contactPhone !== 'string' || !isValidPhoneDigits(contactPhone)) {
      return res.status(400).json({ error: 'Valid contact phone is required.' });
    }

    const updated = await updateUserProviderState(user.id, {
      role: user.role,
      providerStatus: user.providerStatus,
      providerProfile: {
        businessName: businessName.trim(),
        city: city.trim(),
        bio: bio.trim(),
        contactPhone: contactPhone.trim(),
        appliedAt: user.providerProfile?.appliedAt || new Date().toISOString(),
        reviewedAt: user.providerProfile?.reviewedAt ?? null,
        reviewNote: user.providerProfile?.reviewNote || '',
      },
    });

    res.json({ user: updated ? sanitizeUser(updated) : null });
  });

  app.get('/api/provider/overview', requireProvider, async (req: Request, res: Response) => {
    const auth = (req as Request & { auth: AuthContext }).auth;
    const providerId = auth.userId!;
    const [myProducts, allOrders, allReports] = await Promise.all([
      listProducts({ providerId }),
      listOrders(),
      listConditionReports(),
    ]);

    const myProductIds = new Set(myProducts.map((p) => p.id));
    const providerOrders = allOrders.filter((o) =>
      o.items.some((item) => item.providerId === providerId || myProductIds.has(item.productId)),
    );

    let bookingRequestsCount = 0;
    let activeRentalsCount = 0;
    let totalEarnings = 0;

    for (const order of providerOrders) {
      const ownItems = order.items.filter(
        (item) => item.providerId === providerId || myProductIds.has(item.productId),
      );
      for (const item of ownItems) {
        const st = item.itemStatus || order.orderStatus;
        if (st === 'Order Placed') bookingRequestsCount += 1;
        if (st === 'Confirmed' || st === 'Ready for Pickup' || st === 'Rented') {
          activeRentalsCount += 1;
        }
        if (st !== 'Cancelled') {
          totalEarnings += item.lineTotal;
        }
      }
    }

    const myReports = allReports.filter(
      (r) => r.providerId === providerId || myProductIds.has(r.productId),
    );

    res.json({
      stats: {
        totalListings: myProducts.length,
        approvedListings: myProducts.filter((p) => p.approvalStatus === 'approved').length,
        pendingListings: myProducts.filter((p) => p.approvalStatus === 'pending').length,
        rejectedListings: myProducts.filter((p) => p.approvalStatus === 'rejected').length,
        bookingRequestsCount,
        activeRentalsCount,
        totalOrders: providerOrders.length,
        pendingReports: myReports.filter((r) => r.adminStatus === 'Pending Review').length,
        totalEarnings,
      },
    });
  });

  app.get('/api/provider/products', requireProvider, async (req: Request, res: Response) => {
    const auth = (req as Request & { auth: AuthContext }).auth;
    const products = await listProducts({ providerId: auth.userId! });
    res.json({ products });
  });

  app.post('/api/provider/products', requireProvider, async (req: Request, res: Response) => {
    const auth = (req as Request & { auth: AuthContext }).auth;
    const user = await findUserById(auth.userId!);
    if (!user) return res.status(401).json({ error: 'Account not found.' });

    const {
      name = '',
      code = '',
      description = '',
      categoryId = '',
      pricePerDay,
      image = '',
      totalUnits = 1,
      available = true,
      condition = 'Mint',
      conditionNotes = 'Inspected and ready for rental.',
    } = req.body ?? {};

    if (typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Product name must be at least 2 characters.' });
    }
    const finalCode =
      typeof code === 'string' && code.trim().length >= 3
        ? code.trim().toUpperCase()
        : `BB-PRV-${crypto.randomInt(100, 999)}`;
    if (typeof description !== 'string' || description.trim().length < 10) {
      return res.status(400).json({ error: 'Description must be at least 10 characters.' });
    }
    const category = await getCategoryById(String(categoryId));
    if (!category) {
      return res.status(400).json({ error: 'Please select a valid category.' });
    }
    const parsedPrice = Number(pricePerDay);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: 'Daily rental price must be greater than 0.' });
    }
    const parsedUnits = Math.floor(Number(totalUnits));
    if (!Number.isFinite(parsedUnits) || parsedUnits < 1) {
      return res.status(400).json({ error: 'Available units must be at least 1.' });
    }
    const imagePath = typeof image === 'string' && image.trim() ? image.trim() : 'images/product-placeholder.jpg';
    if (!isValidProductImage(imagePath)) {
      return res.status(400).json({
        error: 'Please upload a valid PNG/JPEG/WebP image or enter a valid image URL/path.',
      });
    }
    const safeCondition: ProductCondition = VALID_PRODUCT_CONDITIONS.includes(condition)
      ? condition
      : 'Mint';

    const existing = await listProducts();
    if (existing.some((p) => p.code.toLowerCase() === finalCode.toLowerCase())) {
      return res.status(409).json({ error: 'A product with this product code already exists.' });
    }

    const created = await createProduct({
      name,
      code: finalCode,
      description,
      categoryId: category.id,
      categoryName: category.name,
      pricePerDay: parsedPrice,
      image: imagePath,
      totalUnits: parsedUnits,
      available: Boolean(available),
      featured: false,
      condition: safeCondition,
      conditionNotes: typeof conditionNotes === 'string' ? conditionNotes : 'Inspected and ready for rental.',
      providerId: user.id,
      providerName: user.providerProfile?.businessName || user.fullName,
      providerCity: user.providerProfile?.city || 'Campus Hub',
      providerBio:
        user.providerProfile?.bio ||
        `Independent BorrowBox rental partner (${user.fullName}).`,
      approvalStatus: user.role === 'admin' ? 'approved' : 'pending',
    });

    res.status(201).json({ product: created });
  });

  app.put('/api/provider/products/:id', requireProvider, async (req: Request, res: Response) => {
    const auth = (req as Request & { auth: AuthContext }).auth;
    const existing = await getProductById(String(req.params.id));
    if (!existing || existing.providerId !== auth.userId) {
      return res.status(404).json({ error: 'Listing not found in your provider inventory.' });
    }

    const {
      name = existing.name,
      code = existing.code,
      description = existing.description,
      categoryId = existing.categoryId,
      pricePerDay = existing.pricePerDay,
      image = existing.image,
      totalUnits = existing.totalUnits,
      available = existing.available,
      condition = existing.condition,
      conditionNotes = existing.conditionNotes,
    } = req.body ?? {};

    if (typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Product name must be at least 2 characters.' });
    }
    if (typeof code !== 'string' || code.trim().length < 3) {
      return res.status(400).json({ error: 'Product code is required.' });
    }
    if (typeof description !== 'string' || description.trim().length < 10) {
      return res.status(400).json({ error: 'Description must be at least 10 characters.' });
    }
    const category = await getCategoryById(String(categoryId));
    if (!category) {
      return res.status(400).json({ error: 'Please select a valid category.' });
    }
    const parsedPrice = Number(pricePerDay);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: 'Daily rental price must be greater than 0.' });
    }
    const parsedUnits = Math.floor(Number(totalUnits));
    if (!Number.isFinite(parsedUnits) || parsedUnits < 1) {
      return res.status(400).json({ error: 'Units must be at least 1.' });
    }
    if (typeof image !== 'string' || !isValidProductImage(image)) {
      return res.status(400).json({ error: 'Please provide a valid image upload, path, or URL.' });
    }

    const allProducts = await listProducts();
    if (
      allProducts.some(
        (p) => p.id !== existing.id && p.code.toLowerCase() === code.trim().toLowerCase(),
      )
    ) {
      return res.status(409).json({ error: 'Another product already uses this code.' });
    }

    const safeCondition: ProductCondition = VALID_PRODUCT_CONDITIONS.includes(condition)
      ? condition
      : existing.condition;

    const nextApproval: ListingApprovalStatus =
      existing.approvalStatus === 'rejected' ? 'pending' : existing.approvalStatus;

    const updated = await updateProduct(existing.id, {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim(),
      categoryId: category.id,
      categoryName: category.name,
      pricePerDay: parsedPrice,
      image: image.trim(),
      totalUnits: parsedUnits,
      available: Boolean(available),
      condition: safeCondition,
      conditionNotes: typeof conditionNotes === 'string' ? conditionNotes.trim() : existing.conditionNotes,
      approvalStatus: nextApproval,
      approvalNote: nextApproval === 'pending' ? '' : existing.approvalNote,
    });

    res.json({ product: updated });
  });

  app.patch('/api/provider/products/:id/condition', requireProvider, async (req: Request, res: Response) => {
    const auth = (req as Request & { auth: AuthContext }).auth;
    const existing = await getProductById(String(req.params.id));
    if (!existing || existing.providerId !== auth.userId) {
      return res.status(404).json({ error: 'Listing not found in your provider inventory.' });
    }

    const { condition, conditionNotes, available } = req.body ?? {};
    const patch: Partial<Omit<ProductRecord, 'id' | 'createdAt'>> = {};
    if (condition && VALID_PRODUCT_CONDITIONS.includes(condition)) {
      patch.condition = condition as ProductCondition;
    }
    if (typeof conditionNotes === 'string') {
      patch.conditionNotes = conditionNotes.trim() || existing.conditionNotes;
    }
    if (typeof available === 'boolean') {
      patch.available = available;
    }

    const updated = await updateProduct(existing.id, patch);
    res.json({ product: updated });
  });

  app.delete('/api/provider/products/:id', requireProvider, async (req: Request, res: Response) => {
    const auth = (req as Request & { auth: AuthContext }).auth;
    const existing = await getProductById(String(req.params.id));
    if (!existing || existing.providerId !== auth.userId) {
      return res.status(404).json({ error: 'Listing not found in your provider inventory.' });
    }
    await deleteProduct(existing.id);
    res.json({ ok: true });
  });

  app.get('/api/provider/orders', requireProvider, async (req: Request, res: Response) => {
    const auth = (req as Request & { auth: AuthContext }).auth;
    const providerId = auth.userId!;
    const [orders, myProducts] = await Promise.all([
      listOrders(),
      listProducts({ providerId }),
    ]);
    const myProductIds = new Set(myProducts.map((p) => p.id));

    const providerOrders = orders
      .filter((order) =>
        order.items.some((i) => i.providerId === providerId || myProductIds.has(i.productId)),
      )
      .map((order) => ({
        ...order,
        items: order.items.filter(
          (i) => i.providerId === providerId || myProductIds.has(i.productId),
        ),
      }));

    res.json({ orders: providerOrders });
  });

  app.patch('/api/provider/orders/:id/status', requireProvider, async (req: Request, res: Response) => {
    const auth = (req as Request & { auth: AuthContext }).auth;
    const status = req.body?.status;
    if (!VALID_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid booking status provided.' });
    }
    const updated = await updateProviderOrderItemsStatus(
      String(req.params.id),
      auth.userId!,
      status,
    );
    if (!updated) {
      return res.status(404).json({ error: 'Booking request not found for your listings.' });
    }
    if (status === 'Returned' || status === 'Cancelled') {
      for (const item of updated.items) {
        if (item.providerId === auth.userId) {
          await updateProduct(item.productId, { available: true });
        }
      }
    }
    res.json({ order: updated });
  });

  app.get('/api/provider/condition-reports', requireProvider, async (req: Request, res: Response) => {
    const auth = (req as Request & { auth: AuthContext }).auth;
    const providerId = auth.userId!;
    const [reports, myProducts] = await Promise.all([
      listConditionReports(),
      listProducts({ providerId }),
    ]);
    const myProductIds = new Set(myProducts.map((p) => p.id));
    const filtered = reports.filter(
      (r) => r.providerId === providerId || myProductIds.has(r.productId),
    );
    res.json({ reports: filtered });
  });

  app.patch('/api/provider/condition-reports/:id', requireProvider, async (req: Request, res: Response) => {
    const auth = (req as Request & { auth: AuthContext }).auth;
    const existing = await getConditionReportById(String(req.params.id));
    if (!existing) {
      return res.status(404).json({ error: 'Condition report not found.' });
    }
    const product = await getProductById(existing.productId);
    if (!product || product.providerId !== auth.userId) {
      return res.status(403).json({ error: 'You can only review reports for your own listings.' });
    }

    const {
      adminStatus = existing.adminStatus,
      damageDetected = existing.damageDetected,
      adminNotes = '',
      updateProductConditionTo,
      updateProductConditionNotes,
      setProductAvailable,
    } = req.body ?? {};

    if (!VALID_REVIEW_STATUSES.includes(adminStatus)) {
      return res.status(400).json({ error: 'Invalid review status.' });
    }

    const updatedReport = await reviewConditionReport(existing.id, {
      adminStatus,
      damageDetected: Boolean(damageDetected),
      adminNotes: typeof adminNotes === 'string' ? adminNotes : '',
    });

    let updatedProduct: ProductRecord | null = null;
    if (updateProductConditionTo && VALID_PRODUCT_CONDITIONS.includes(updateProductConditionTo)) {
      const patch: Partial<Omit<ProductRecord, 'id' | 'createdAt'>> = {
        condition: updateProductConditionTo as ProductCondition,
      };
      if (typeof updateProductConditionNotes === 'string' && updateProductConditionNotes.trim()) {
        patch.conditionNotes = updateProductConditionNotes.trim();
      }
      if (typeof setProductAvailable === 'boolean') {
        patch.available = setProductAvailable;
      }
      updatedProduct = await updateProduct(existing.productId, patch);
    }

    res.json({ report: updatedReport, product: updatedProduct });
  });

  // -------------------- ADMIN PROTECTED ROUTES --------------------

  app.get('/api/admin/overview', requireAdmin, async (_req: Request, res: Response) => {
    const [products, customers, providers, orders, categories, bundles, reports] = await Promise.all([
      listProducts(),
      listCustomers(),
      listProvidersAndApplicants(),
      listOrders(),
      listCategories(),
      listBundles(),
      listConditionReports(),
    ]);

    const pendingOrders = orders.filter(
      (o) => o.orderStatus === 'Order Placed' || o.orderStatus === 'Confirmed',
    ).length;
    const availableProducts = products.filter(
      (p) => p.available && p.approvalStatus === 'approved',
    ).length;
    const pendingListingApprovals = products.filter((p) => p.approvalStatus === 'pending').length;
    const pendingProviders = providers.filter((u) => u.providerStatus === 'pending').length;
    const totalProviders = providers.filter(
      (u) => u.role === 'provider' && u.providerStatus === 'approved',
    ).length;
    const pendingReports = reports.filter((r) => r.adminStatus === 'Pending Review').length;
    const totalRevenue = orders
      .filter((o) => o.orderStatus !== 'Cancelled')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    res.json({
      stats: {
        totalProducts: products.length,
        availableProducts,
        pendingListingApprovals,
        totalProviders,
        pendingProviders,
        totalCustomers: customers.length,
        totalOrders: orders.length,
        pendingOrders,
        totalCategories: categories.length,
        totalBundles: bundles.length,
        pendingReports,
        totalRevenue,
      },
      newArrivals: products.slice(0, 5),
      recentOrders: orders.slice(0, 6),
    });
  });

  app.get('/api/admin/products', requireAdmin, async (_req: Request, res: Response) => {
    const products = await listProducts();
    res.json({ products });
  });

  app.post('/api/admin/products', requireAdmin, async (req: Request, res: Response) => {
    const {
      name = '',
      code = '',
      description = '',
      categoryId = '',
      pricePerDay,
      image = '',
      totalUnits = 1,
      available = true,
      featured = false,
      condition = 'Mint',
      conditionNotes = 'Inspected and ready for rental.',
    } = req.body ?? {};

    if (typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Product name must be at least 2 characters.' });
    }
    if (typeof code !== 'string' || code.trim().length < 3) {
      return res.status(400).json({ error: 'Product code is required (min 3 characters).' });
    }
    if (typeof description !== 'string' || description.trim().length < 10) {
      return res.status(400).json({ error: 'Description must be at least 10 characters.' });
    }
    const category = await getCategoryById(String(categoryId));
    if (!category) {
      return res.status(400).json({ error: 'Please select a valid category.' });
    }
    const parsedPrice = Number(pricePerDay);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: 'Daily rental price must be greater than 0.' });
    }
    const parsedUnits = Math.floor(Number(totalUnits));
    if (!Number.isFinite(parsedUnits) || parsedUnits < 1) {
      return res.status(400).json({ error: 'Available units must be at least 1.' });
    }
    const imagePath = typeof image === 'string' && image.trim() ? image.trim() : 'images/product-placeholder.jpg';
    if (!isValidProductImage(imagePath)) {
      return res.status(400).json({
        error: 'Please enter a valid relative path (images/...), uploaded image, or http/https URL.',
      });
    }
    const safeCondition: ProductCondition = VALID_PRODUCT_CONDITIONS.includes(condition)
      ? condition
      : 'Mint';

    const existing = await listProducts();
    if (existing.some((p) => p.code.toLowerCase() === code.trim().toLowerCase())) {
      return res.status(409).json({ error: 'A product with this product code already exists.' });
    }

    const created = await createProduct({
      name,
      code,
      description,
      categoryId: category.id,
      categoryName: category.name,
      pricePerDay: parsedPrice,
      image: imagePath,
      totalUnits: parsedUnits,
      available: Boolean(available),
      featured: Boolean(featured),
      condition: safeCondition,
      conditionNotes: typeof conditionNotes === 'string' ? conditionNotes : 'Inspected and ready for rental.',
      approvalStatus: 'approved',
    });

    res.status(201).json({ product: created });
  });

  app.put('/api/admin/products/:id', requireAdmin, async (req: Request, res: Response) => {
    const existing = await getProductById(String(req.params.id));
    if (!existing) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const {
      name = existing.name,
      code = existing.code,
      description = existing.description,
      categoryId = existing.categoryId,
      pricePerDay = existing.pricePerDay,
      image = existing.image,
      totalUnits = existing.totalUnits,
      available = existing.available,
      featured = existing.featured,
      condition = existing.condition,
      conditionNotes = existing.conditionNotes,
    } = req.body ?? {};

    if (typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Product name must be at least 2 characters.' });
    }
    if (typeof code !== 'string' || code.trim().length < 3) {
      return res.status(400).json({ error: 'Product code is required.' });
    }
    if (typeof description !== 'string' || description.trim().length < 10) {
      return res.status(400).json({ error: 'Description must be at least 10 characters.' });
    }
    const category = await getCategoryById(String(categoryId));
    if (!category) {
      return res.status(400).json({ error: 'Please select a valid category.' });
    }
    const parsedPrice = Number(pricePerDay);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: 'Daily rental price must be greater than 0.' });
    }
    const parsedUnits = Math.floor(Number(totalUnits));
    if (!Number.isFinite(parsedUnits) || parsedUnits < 1) {
      return res.status(400).json({ error: 'Units must be at least 1.' });
    }
    if (typeof image !== 'string' || !isValidProductImage(image)) {
      return res.status(400).json({ error: 'Please provide a valid image path, upload, or URL.' });
    }

    const allProducts = await listProducts();
    if (
      allProducts.some(
        (p) => p.id !== existing.id && p.code.toLowerCase() === code.trim().toLowerCase(),
      )
    ) {
      return res.status(409).json({ error: 'Another product already uses this code.' });
    }

    const safeCondition: ProductCondition = VALID_PRODUCT_CONDITIONS.includes(condition)
      ? condition
      : existing.condition;

    const updated = await updateProduct(existing.id, {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim(),
      categoryId: category.id,
      categoryName: category.name,
      pricePerDay: parsedPrice,
      image: image.trim(),
      totalUnits: parsedUnits,
      available: Boolean(available),
      featured: Boolean(featured),
      condition: safeCondition,
      conditionNotes: typeof conditionNotes === 'string' ? conditionNotes.trim() : existing.conditionNotes,
    });

    res.json({ product: updated });
  });

  app.patch('/api/admin/products/:id/approval', requireAdmin, async (req: Request, res: Response) => {
    const existing = await getProductById(String(req.params.id));
    if (!existing) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    const { approvalStatus = '', approvalNote = '' } = req.body ?? {};
    if (!['pending', 'approved', 'rejected'].includes(approvalStatus)) {
      return res.status(400).json({ error: 'Invalid listing approval status.' });
    }
    const updated = await updateProduct(existing.id, {
      approvalStatus: approvalStatus as ListingApprovalStatus,
      approvalNote: typeof approvalNote === 'string' ? approvalNote.trim() : '',
    });
    res.json({ product: updated });
  });

  app.delete('/api/admin/products/:id', requireAdmin, async (req: Request, res: Response) => {
    const deleted = await deleteProduct(String(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    res.json({ ok: true });
  });

  // Admin Bundle CRUD
  app.get('/api/admin/bundles', requireAdmin, async (_req: Request, res: Response) => {
    const [bundles, products] = await Promise.all([listBundles(), listProducts()]);
    const productMap = new Map(products.map((p) => [p.id, p]));
    res.json({ bundles: bundles.map((b) => enrichBundle(b, productMap)) });
  });

  app.post('/api/admin/bundles', requireAdmin, async (req: Request, res: Response) => {
    const {
      name = '',
      code = '',
      description = '',
      image = '',
      productIds = [],
      bundlePricePerDay,
      featured = true,
    } = req.body ?? {};

    if (typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Bundle name must be at least 2 characters.' });
    }
    if (typeof code !== 'string' || code.trim().length < 3) {
      return res.status(400).json({ error: 'Bundle code is required.' });
    }
    if (typeof description !== 'string' || description.trim().length < 8) {
      return res.status(400).json({ error: 'Bundle description must be at least 8 characters.' });
    }
    if (!Array.isArray(productIds) || productIds.length < 2) {
      return res.status(400).json({ error: 'Select at least 2 products to create a bundle.' });
    }
    const parsedPrice = Number(bundlePricePerDay);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: 'Bundle daily price must be greater than 0.' });
    }
    const imagePath = typeof image === 'string' && image.trim() ? image.trim() : 'images/bundle-kit.jpg';
    if (!isValidImageUrl(imagePath)) {
      return res.status(400).json({ error: 'Please provide a valid bundle image path or URL.' });
    }

    const products = await listProducts();
    const productMap = new Map(products.map((p) => [p.id, p]));
    const validIds = [...new Set(productIds.map(String))].filter((id) => productMap.has(id));
    if (validIds.length < 2) {
      return res.status(400).json({ error: 'At least 2 valid products must be included in the bundle.' });
    }

    const created = await createBundle({
      name,
      code,
      description,
      image: imagePath,
      productIds: validIds,
      bundlePricePerDay: parsedPrice,
      featured: Boolean(featured),
    });

    res.status(201).json({ bundle: enrichBundle(created, productMap) });
  });

  app.put('/api/admin/bundles/:id', requireAdmin, async (req: Request, res: Response) => {
    const existing = await getBundleById(String(req.params.id));
    if (!existing) {
      return res.status(404).json({ error: 'Bundle not found.' });
    }
    const {
      name = existing.name,
      code = existing.code,
      description = existing.description,
      image = existing.image,
      productIds = existing.productIds,
      bundlePricePerDay = existing.bundlePricePerDay,
      featured = existing.featured,
    } = req.body ?? {};

    if (typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Bundle name must be at least 2 characters.' });
    }
    if (!Array.isArray(productIds) || productIds.length < 2) {
      return res.status(400).json({ error: 'Select at least 2 products in the bundle.' });
    }
    const parsedPrice = Number(bundlePricePerDay);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: 'Bundle price must be greater than 0.' });
    }
    if (typeof image !== 'string' || !isValidImageUrl(image)) {
      return res.status(400).json({ error: 'Please provide a valid bundle image path or URL.' });
    }

    const products = await listProducts();
    const productMap = new Map(products.map((p) => [p.id, p]));
    const validIds = [...new Set(productIds.map(String))].filter((id) => productMap.has(id));
    if (validIds.length < 2) {
      return res.status(400).json({ error: 'At least 2 valid products must be included.' });
    }

    const updated = await updateBundle(existing.id, {
      name: name.trim(),
      code: String(code).trim().toUpperCase(),
      description: String(description).trim(),
      image: image.trim(),
      productIds: validIds,
      bundlePricePerDay: parsedPrice,
      featured: Boolean(featured),
    });

    res.json({ bundle: updated ? enrichBundle(updated, productMap) : null });
  });

  app.delete('/api/admin/bundles/:id', requireAdmin, async (req: Request, res: Response) => {
    const deleted = await deleteBundle(String(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: 'Bundle not found.' });
    }
    res.json({ ok: true });
  });

  // Admin Condition Reports Review
  app.get('/api/admin/condition-reports', requireAdmin, async (_req: Request, res: Response) => {
    const reports = await listConditionReports();
    res.json({ reports });
  });

  app.patch('/api/admin/condition-reports/:id', requireAdmin, async (req: Request, res: Response) => {
    const existing = await getConditionReportById(String(req.params.id));
    if (!existing) {
      return res.status(404).json({ error: 'Condition report not found.' });
    }

    const {
      adminStatus = existing.adminStatus,
      damageDetected = existing.damageDetected,
      adminNotes = '',
      updateProductConditionTo,
      updateProductConditionNotes,
      setProductAvailable,
    } = req.body ?? {};

    if (!VALID_REVIEW_STATUSES.includes(adminStatus)) {
      return res.status(400).json({ error: 'Invalid review status.' });
    }

    const updatedReport = await reviewConditionReport(existing.id, {
      adminStatus,
      damageDetected: Boolean(damageDetected),
      adminNotes: typeof adminNotes === 'string' ? adminNotes : '',
    });

    let updatedProduct: ProductRecord | null = null;
    if (updateProductConditionTo && VALID_PRODUCT_CONDITIONS.includes(updateProductConditionTo)) {
      const patch: Partial<Omit<ProductRecord, 'id' | 'createdAt'>> = {
        condition: updateProductConditionTo as ProductCondition,
      };
      if (typeof updateProductConditionNotes === 'string' && updateProductConditionNotes.trim()) {
        patch.conditionNotes = updateProductConditionNotes.trim();
      }
      if (typeof setProductAvailable === 'boolean') {
        patch.available = setProductAvailable;
      }
      updatedProduct = await updateProduct(existing.productId, patch);
    }

    res.json({ report: updatedReport, product: updatedProduct });
  });

  app.get('/api/admin/categories', requireAdmin, async (_req: Request, res: Response) => {
    const [categories, products] = await Promise.all([listCategories(), listProducts()]);
    res.json({
      categories: categories.map((c) => ({
        ...c,
        productCount: products.filter((p) => p.categoryId === c.id).length,
      })),
    });
  });

  app.post('/api/admin/categories', requireAdmin, async (req: Request, res: Response) => {
    const { name = '', description = '', image = '' } = req.body ?? {};
    if (typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Category name must be at least 2 characters.' });
    }
    if (typeof description !== 'string' || description.trim().length < 6) {
      return res.status(400).json({ error: 'Category description must be at least 6 characters.' });
    }
    const existing = await listCategories();
    if (existing.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) {
      return res.status(409).json({ error: 'A category with this name already exists.' });
    }
    if (image && !isValidImageUrl(String(image))) {
      return res.status(400).json({ error: 'Invalid category image URL.' });
    }

    const created = await createCategory({ name, description, image: String(image || '') });
    res.status(201).json({ category: created });
  });

  app.put('/api/admin/categories/:id', requireAdmin, async (req: Request, res: Response) => {
    const { name = '', description = '', image = '' } = req.body ?? {};
    if (typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Category name must be at least 2 characters.' });
    }
    if (typeof description !== 'string' || description.trim().length < 6) {
      return res.status(400).json({ error: 'Category description must be at least 6 characters.' });
    }
    if (image && !isValidImageUrl(String(image))) {
      return res.status(400).json({ error: 'Invalid category image URL.' });
    }

    const updated = await updateCategory(String(req.params.id), {
      name,
      description,
      image: image ? String(image) : undefined,
    });
    if (!updated) {
      return res.status(404).json({ error: 'Category not found.' });
    }
    res.json({ category: updated });
  });

  app.delete('/api/admin/categories/:id', requireAdmin, async (req: Request, res: Response) => {
    const result = await deleteCategory(String(req.params.id));
    if (!result.ok) {
      return res.status(409).json({ error: result.reason });
    }
    res.json({ ok: true });
  });

  app.get('/api/admin/orders', requireAdmin, async (_req: Request, res: Response) => {
    const orders = await listOrders();
    res.json({ orders });
  });

  app.patch('/api/admin/orders/:id/status', requireAdmin, async (req: Request, res: Response) => {
    const status = req.body?.status;
    if (!VALID_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid order status provided.' });
    }
    const updated = await updateOrderStatus(String(req.params.id), status);
    if (!updated) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (status === 'Returned' || status === 'Cancelled') {
      for (const item of updated.items) {
        if (item.includedProductIds && item.includedProductIds.length > 0) {
          for (const pid of item.includedProductIds) {
            await updateProduct(pid, { available: true });
          }
        } else {
          await updateProduct(item.productId, { available: true });
        }
      }
    }
    res.json({ order: updated });
  });

  app.get('/api/admin/providers', requireAdmin, async (_req: Request, res: Response) => {
    const [providers, products] = await Promise.all([
      listProvidersAndApplicants(),
      listProducts(),
    ]);
    const list = providers.map((u) => {
      const ownProducts = products.filter((p) => p.providerId === u.id);
      return {
        ...sanitizeUser(u),
        listingCount: ownProducts.length,
        approvedListingCount: ownProducts.filter((p) => p.approvalStatus === 'approved').length,
      };
    });
    res.json({ providers: list });
  });

  app.patch('/api/admin/providers/:id/status', requireAdmin, async (req: Request, res: Response) => {
    const target = await findUserById(String(req.params.id));
    if (!target || target.role === 'admin') {
      return res.status(404).json({ error: 'Provider applicant not found.' });
    }
    const { status = '', reviewNote = '' } = req.body ?? {};
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid provider decision status.' });
    }

    const nextRole: UserRole = status === 'approved' ? 'provider' : 'customer';
    const nextStatus = status as ProviderStatus;
    const profile = target.providerProfile || {
      businessName: target.fullName,
      city: 'Campus Hub',
      bio: 'BorrowBox rental partner.',
      contactPhone: target.phone || '+910000000000',
      appliedAt: target.createdAt,
    };

    const updated = await updateUserProviderState(target.id, {
      role: nextRole,
      providerStatus: nextStatus,
      providerProfile: {
        ...profile,
        reviewedAt: new Date().toISOString(),
        reviewNote: typeof reviewNote === 'string' ? reviewNote.trim() : '',
      },
    });

    // If a provider is rejected/suspended, ensure their listings are no longer publicly visible
    if (status === 'rejected') {
      const ownProducts = await listProducts({ providerId: target.id });
      for (const p of ownProducts) {
        if (p.approvalStatus === 'approved') {
          await updateProduct(p.id, {
            approvalStatus: 'rejected',
            approvalNote:
              typeof reviewNote === 'string' && reviewNote.trim()
                ? reviewNote.trim()
                : 'Provider status was revoked by administrator.',
          });
        }
      }
    }

    res.json({ provider: updated ? sanitizeUser(updated) : null });
  });

  app.get('/api/admin/customers', requireAdmin, async (_req: Request, res: Response) => {
    const [customers, orders] = await Promise.all([listCustomers(), listOrders()]);
    const sanitized = customers.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      email: c.email,
      phone: c.phone || 'Not provided',
      role: c.role,
      providerStatus: c.providerStatus,
      businessName: c.providerProfile?.businessName,
      authProvider: c.authProvider,
      createdAt: c.createdAt,
      orderCount: orders.filter((o) => o.userId === c.id).length,
    }));
    res.json({ customers: sanitized });
  });

  // -------------------- FRONTEND SERVING --------------------

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Production build not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BorrowBox] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[BorrowBox] Fatal startup error:', err);
  process.exit(1);
});
