import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { MongoClient, type Db } from 'mongodb';

export type UserRole = 'customer' | 'provider' | 'admin';
export type AuthProvider = 'email' | 'phone' | 'google';
export type ProviderStatus = 'none' | 'pending' | 'approved' | 'rejected';
export type ListingApprovalStatus = 'pending' | 'approved' | 'rejected';
export type OrderStatus =
  | 'Order Placed'
  | 'Confirmed'
  | 'Ready for Pickup'
  | 'Rented'
  | 'Returned'
  | 'Cancelled';
export type PaymentMethod = 'cod' | 'demo_online';
export type PaymentStatus = 'Pending' | 'Paid (Demo)' | 'Paid on Delivery' | 'Refunded';
export type ProductCondition = 'Mint' | 'Good' | 'Fair' | 'Needs Maintenance';
export type ReturnReportedCondition = 'Mint' | 'Good' | 'Fair' | 'Damaged';
export type ReportReviewStatus = 'Pending Review' | 'Reviewed - Cleared' | 'Damage Flagged';

export interface ProviderProfile {
  businessName: string;
  city: string;
  bio: string;
  contactPhone: string;
  appliedAt: string;
  reviewedAt?: string | null;
  reviewNote?: string;
}

export interface UserRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string | null;
  role: UserRole;
  authProvider: AuthProvider;
  googleId?: string;
  providerStatus: ProviderStatus;
  providerProfile?: ProviderProfile;
  createdAt: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  createdAt: string;
}

export interface ProductRecord {
  id: string;
  name: string;
  code: string;
  description: string;
  categoryId: string;
  categoryName: string;
  pricePerDay: number;
  image: string;
  totalUnits: number;
  available: boolean;
  featured: boolean;
  condition: ProductCondition;
  conditionNotes: string;
  providerId: string;
  providerName: string;
  providerCity: string;
  providerBio: string;
  approvalStatus: ListingApprovalStatus;
  approvalNote?: string;
  createdAt: string;
}

export interface BundleRecord {
  id: string;
  name: string;
  code: string;
  description: string;
  image: string;
  productIds: string[];
  bundlePricePerDay: number;
  featured: boolean;
  createdAt: string;
}

export interface CartItemRecord {
  id: string;
  productId?: string;
  bundleId?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  quantity: number;
}

export interface OrderItemRecord {
  productId: string;
  bundleId?: string;
  includedProductIds?: string[];
  includedProductNames?: string[];
  providerId?: string;
  providerName?: string;
  itemStatus?: OrderStatus;
  productName: string;
  productCode: string;
  productImage: string;
  categoryName: string;
  pricePerDay: number;
  startDate: string;
  endDate: string;
  days: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  city: string;
  pinCode: string;
  items: OrderItemRecord[];
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  transactionRef: string | null;
  orderStatus: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ConditionReportRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  productId: string;
  productName: string;
  providerId?: string;
  providerName?: string;
  userId: string;
  customerName: string;
  reportedCondition: ReturnReportedCondition;
  customerNotes: string;
  photos: string[];
  damageDetected: boolean;
  adminStatus: ReportReviewStatus;
  adminNotes: string;
  createdAt: string;
  reviewedAt: string | null;
}

export interface AppTokenSession {
  token: string;
  userId: string;
  role: UserRole;
  cart: CartItemRecord[];
  expiresAt: number;
}

interface DatabaseSchema {
  users: UserRecord[];
  categories: CategoryRecord[];
  products: ProductRecord[];
  bundles: BundleRecord[];
  orders: OrderRecord[];
  conditionReports: ConditionReportRecord[];
  carts: Record<string, CartItemRecord[]>;
  tokenSessions: Record<string, AppTokenSession>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'borrowbox.json');

const PHOTO_URLS = {
  dslr: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Canon_EOS_7D_DSLR_body_front.jpg/960px-Canon_EOS_7D_DSLR_body_front.jpg',
  tripod:
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c7/%28Photography_equipment_Tripod_Photo_Camera_Tripod_photograph_in_a_studio%29.jpg/960px-%28Photography_equipment_Tripod_Photo_Camera_Tripod_photograph_in_a_studio%29.jpg',
  projector:
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/BenQ_DLP_projector_MP515_20101213.jpg/960px-BenQ_DLP_projector_MP515_20101213.jpg',
  calculator:
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ce/Casio_fx-991EX_Scientific_Calculator.jpg/960px-Casio_fx-991EX_Scientific_Calculator.jpg',
  graphing:
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/TI-84_Plus_front.jpg/960px-TI-84_Plus_front.jpg',
  badminton:
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ad/Rachet%C4%83_de_badminton_%C5%9Fi_flutura%C5%9F.jpg/960px-Rachet%C4%83_de_badminton_%C5%9Fi_flutura%C5%9F.jpg',
  lighting:
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f9/PhotoSEL_LS21E52_Softbox_Studio_Lighting_Kit.JPG/960px-PhotoSEL_LS21E52_Softbox_Studio_Lighting_Kit.JPG',
  camping:
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e2/Camping_in_the_mountains_%28Unsplash%29.jpg/960px-Camping_in_the_mountains_%28Unsplash%29.jpg',
  sleepingBag:
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2e/Mummy_bag.jpg/960px-Mummy_bag.jpg',
  microphone:
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2e/Blue_Snowflake_USB_microphone.jpg/960px-Blue_Snowflake_USB_microphone.jpg',
  speaker:
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/JBL_Flip_4.jpg/960px-JBL_Flip_4.jpg',
  backpack:
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a3/A_backpack_with_trekking_poles_and_shoes.jpg/960px-A_backpack_with_trekking_poles_and_shoes.jpg',
  actionCam:
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/16/GoPro_Hero_%28film_camera%29%2C_front.jpg/960px-GoPro_Hero_%28film_camera%29%2C_front.jpg',
  dumbbell:
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3a/Gym_Dumbbells_For_Working_Out_%28193383405%29.jpeg/960px-Gym_Dumbbells_For_Working_Out_%28193383405%29.jpeg',
  costume:
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5d/Spotlight_stage_August_Wilson_Center.jpg/960px-Spotlight_stage_August_Wilson_Center.jpg',
};

const LEGACY_IMAGE_UPGRADE_MAP: Record<string, string> = {
  '/src/assets/images/product_camera_1795278341546.jpg': PHOTO_URLS.dslr,
  '/src/assets/images/product_projector_1795278342046.jpg': PHOTO_URLS.projector,
  '/src/assets/images/product_sports_1795278341378.jpg': PHOTO_URLS.badminton,
  '/src/assets/images/product_camping_1795278342049.jpg': PHOTO_URLS.camping,
  'images/tripod.jpg': PHOTO_URLS.tripod,
  'images/calculator.jpg': PHOTO_URLS.calculator,
  'images/lighting-kit.jpg': PHOTO_URLS.lighting,
  'images/sleeping-bag.jpg': PHOTO_URLS.sleepingBag,
  'images/microphone.jpg': PHOTO_URLS.microphone,
  'images/graphing-calculator.jpg': PHOTO_URLS.graphing,
  'images/costume.jpg': PHOTO_URLS.costume,
  'images/speaker.jpg': PHOTO_URLS.speaker,
  'images/backpack.jpg': PHOTO_URLS.backpack,
  'images/fitness-kit.jpg': PHOTO_URLS.dumbbell,
  'images/action-cam.jpg': PHOTO_URLS.actionCam,
  'images/category-default.jpg': PHOTO_URLS.dslr,
};

function upgradeLegacyImage(image: string): string {
  return LEGACY_IMAGE_UPGRADE_MAP[image] || image;
}

const SEED_CATEGORIES: CategoryRecord[] = [
  {
    id: 'cat-photography',
    name: 'Photography',
    slug: 'photography',
    description: 'DSLR cameras, prime lenses, tripods, and studio lighting kits.',
    image: PHOTO_URLS.dslr,
    createdAt: '2026-01-05T09:00:00.000Z',
  },
  {
    id: 'cat-electronics',
    name: 'Electronics',
    slug: 'electronics',
    description: 'Full HD projectors, presentation tools, and studio microphones.',
    image: PHOTO_URLS.projector,
    createdAt: '2026-01-05T09:05:00.000Z',
  },
  {
    id: 'cat-education',
    name: 'Education',
    slug: 'education',
    description: 'Scientific and graphing calculators for exams and coursework.',
    image: PHOTO_URLS.calculator,
    createdAt: '2026-01-05T09:10:00.000Z',
  },
  {
    id: 'cat-sports',
    name: 'Sports & Fitness',
    slug: 'sports-fitness',
    description: 'Badminton kits, fitness sets, and weekend court essentials.',
    image: PHOTO_URLS.badminton,
    createdAt: '2026-01-05T09:15:00.000Z',
  },
  {
    id: 'cat-events',
    name: 'Events & Costumes',
    slug: 'events-costumes',
    description: 'Stage costumes, PA speakers, and college fest event accessories.',
    image: PHOTO_URLS.costume,
    createdAt: '2026-01-05T09:20:00.000Z',
  },
  {
    id: 'cat-travel',
    name: 'Travel & Outdoors',
    slug: 'travel-outdoors',
    description: 'Camping tents, sleeping bags, trekking packs, and lanterns.',
    image: PHOTO_URLS.camping,
    createdAt: '2026-01-05T09:25:00.000Z',
  },
];

const DEFAULT_PROVIDER_INFO = {
  providerId: 'provider-borrowbox',
  providerName: 'BorrowBox Verified Hub',
  providerCity: 'Bengaluru',
  providerBio:
    'Official BorrowBox curated gear partner providing inspected photography, electronics, and outdoor rentals.',
  approvalStatus: 'approved' as ListingApprovalStatus,
};

const RAW_SEED_PRODUCTS: Omit<
  ProductRecord,
  'providerId' | 'providerName' | 'providerCity' | 'providerBio' | 'approvalStatus'
>[] = [
  {
    id: 'prod-dslr',
    name: 'Canon DSLR Camera',
    code: 'BB-CAM-101',
    description:
      '24.1MP APS-C DSLR body paired with a sharp 18-55mm & 50mm prime kit, dual batteries, and padded carry case.',
    categoryId: 'cat-photography',
    categoryName: 'Photography',
    pricePerDay: 500,
    image: PHOTO_URLS.dslr,
    totalUnits: 3,
    available: true,
    featured: true,
    condition: 'Mint',
    conditionNotes: 'Sensor cleaned, zero lens scratches, dual batteries tested at 100% health.',
    createdAt: '2026-02-01T10:00:00.000Z',
  },
  {
    id: 'prod-tripod',
    name: 'Tripod Stand',
    code: 'BB-CAM-102',
    description:
      'Lightweight anodized aluminum 3-way fluid head tripod extending to 170cm with quick-release plate.',
    categoryId: 'cat-photography',
    categoryName: 'Photography',
    pricePerDay: 120,
    image: PHOTO_URLS.tripod,
    totalUnits: 5,
    available: true,
    featured: true,
    condition: 'Good',
    conditionNotes: 'Smooth pan/tilt locks; minor surface scuffing on lower leg rubber feet.',
    createdAt: '2026-02-02T10:00:00.000Z',
  },
  {
    id: 'prod-projector',
    name: 'Epson Projector',
    code: 'BB-ELC-201',
    description:
      '3,600 lumens Full HD HDMI portable projector ideal for classroom seminars, pitch decks, and movie nights.',
    categoryId: 'cat-electronics',
    categoryName: 'Electronics',
    pricePerDay: 650,
    image: PHOTO_URLS.projector,
    totalUnits: 2,
    available: true,
    featured: true,
    condition: 'Mint',
    conditionNotes: 'Lamp hours under 120 hrs; HDMI cable, power brick, and remote included.',
    createdAt: '2026-02-03T10:00:00.000Z',
  },
  {
    id: 'prod-calc',
    name: 'Scientific Calculator',
    code: 'BB-EDU-301',
    description:
      'Non-programmable 417-function scientific calculator approved for university engineering and lab exams.',
    categoryId: 'cat-education',
    categoryName: 'Education',
    pricePerDay: 50,
    image: PHOTO_URLS.calculator,
    totalUnits: 12,
    available: true,
    featured: true,
    condition: 'Mint',
    conditionNotes: 'Fresh battery installed; slide-on protective hard cover intact.',
    createdAt: '2026-02-04T10:00:00.000Z',
  },
  {
    id: 'prod-badminton',
    name: 'Badminton Kit',
    code: 'BB-SPT-401',
    description:
      'Two carbon-graphite rackets, featherlight shuttlecock tube, grip wraps, and slate sports duffle bag.',
    categoryId: 'cat-sports',
    categoryName: 'Sports & Fitness',
    pricePerDay: 150,
    image: PHOTO_URLS.badminton,
    totalUnits: 4,
    available: true,
    featured: true,
    condition: 'Good',
    conditionNotes: 'Fresh overgrips wrapped before each booking; string tension 24 lbs verified.',
    createdAt: '2026-02-05T10:00:00.000Z',
  },
  {
    id: 'prod-lighting',
    name: 'Photography Lighting Kit',
    code: 'BB-CAM-103',
    description:
      'Dual 60W bi-color LED softbox studio panels with adjustable stands and diffusion cloths for portraits.',
    categoryId: 'cat-photography',
    categoryName: 'Photography',
    pricePerDay: 300,
    image: PHOTO_URLS.lighting,
    totalUnits: 3,
    available: true,
    featured: true,
    condition: 'Good',
    conditionNotes: 'All LED diodes functional; softbox diffusers laundered and tear-free.',
    createdAt: '2026-02-06T10:00:00.000Z',
  },
  {
    id: 'prod-camping',
    name: '4-Person Camping Tent',
    code: 'BB-TRV-601',
    description:
      'Weatherproof dome tent with fiberglass poles, rainfly, stakes, and rechargeable LED lantern.',
    categoryId: 'cat-travel',
    categoryName: 'Travel & Outdoors',
    pricePerDay: 450,
    image: PHOTO_URLS.camping,
    totalUnits: 3,
    available: true,
    featured: false,
    condition: 'Good',
    conditionNotes: 'Seams waterproof-checked; zippers glide cleanly; aired and brushed post-return.',
    createdAt: '2026-02-07T10:00:00.000Z',
  },
  {
    id: 'prod-sleeping-bag',
    name: 'All-Season Sleeping Bag',
    code: 'BB-TRV-603',
    description:
      'Insulated 5°C-rated mummy sleeping bag with compression stuff sack, freshly sanitized after every trip.',
    categoryId: 'cat-travel',
    categoryName: 'Travel & Outdoors',
    pricePerDay: 140,
    image: PHOTO_URLS.sleepingBag,
    totalUnits: 5,
    available: true,
    featured: false,
    condition: 'Mint',
    conditionNotes: 'Freshly laundered thermal liner, snag-free two-way zipper.',
    createdAt: '2026-02-07T12:00:00.000Z',
  },
  {
    id: 'prod-mic',
    name: 'Studio Condenser Microphone',
    code: 'BB-ELC-202',
    description:
      'Cardioid USB/XLR condenser microphone with shock mount and desk boom arm for podcasts and voiceovers.',
    categoryId: 'cat-electronics',
    categoryName: 'Electronics',
    pricePerDay: 220,
    image: PHOTO_URLS.microphone,
    totalUnits: 4,
    available: true,
    featured: false,
    condition: 'Mint',
    conditionNotes: 'Sanitized pop filter and braided USB-C/XLR cable included.',
    createdAt: '2026-02-08T10:00:00.000Z',
  },
  {
    id: 'prod-graphing',
    name: 'Graphing Calculator TI-84',
    code: 'BB-EDU-302',
    description:
      'High-resolution color graphing calculator preloaded with matrix, calculus, and statistical plotting tools.',
    categoryId: 'cat-education',
    categoryName: 'Education',
    pricePerDay: 90,
    image: PHOTO_URLS.graphing,
    totalUnits: 6,
    available: true,
    featured: false,
    condition: 'Good',
    conditionNotes: 'Screen scratch-free; USB charging cable included.',
    createdAt: '2026-02-09T10:00:00.000Z',
  },
  {
    id: 'prod-costume',
    name: 'Cultural & Stage Costume Set',
    code: 'BB-EVT-501',
    description:
      'Freshly dry-cleaned theatrical blazer, traditional attire, and stage props curated for college fests.',
    categoryId: 'cat-events',
    categoryName: 'Events & Costumes',
    pricePerDay: 380,
    image: PHOTO_URLS.costume,
    totalUnits: 4,
    available: true,
    featured: false,
    condition: 'Mint',
    conditionNotes: 'Dry-cleaned and steam-pressed before dispatch.',
    createdAt: '2026-02-10T10:00:00.000Z',
  },
  {
    id: 'prod-speaker',
    name: 'Portable PA Event Speaker',
    code: 'BB-EVT-502',
    description:
      '120W Bluetooth party and event speaker with dual wireless handheld microphones and 10-hour battery.',
    categoryId: 'cat-events',
    categoryName: 'Events & Costumes',
    pricePerDay: 550,
    image: PHOTO_URLS.speaker,
    totalUnits: 2,
    available: true,
    featured: false,
    condition: 'Good',
    conditionNotes: 'Clean grille with no dents; wireless mic channels tested.',
    createdAt: '2026-02-11T10:00:00.000Z',
  },
  {
    id: 'prod-backpack',
    name: '60L Trekking Rucksack',
    code: 'BB-TRV-602',
    description:
      'Ergonomic internal-frame hiking backpack with rain cover, hydration sleeve, and padded hip belt.',
    categoryId: 'cat-travel',
    categoryName: 'Travel & Outdoors',
    pricePerDay: 200,
    image: PHOTO_URLS.backpack,
    totalUnits: 5,
    available: true,
    featured: false,
    condition: 'Good',
    conditionNotes: 'All buckles and chest straps intact; rain cover stowed in base pocket.',
    createdAt: '2026-02-12T10:00:00.000Z',
  },
  {
    id: 'prod-fitness',
    name: 'Home Workout Dumbbell Set',
    code: 'BB-SPT-402',
    description:
      'Adjustable 20kg cast-iron dumbbell kit with non-slip yoga mat and resistance bands for short-term training.',
    categoryId: 'cat-sports',
    categoryName: 'Sports & Fitness',
    pricePerDay: 180,
    image: PHOTO_URLS.dumbbell,
    totalUnits: 4,
    available: true,
    featured: false,
    condition: 'Fair',
    conditionNotes: 'Minor cosmetic paint wear on weight plates; spin-lock collars fully secure.',
    createdAt: '2026-02-13T10:00:00.000Z',
  },
  {
    id: 'prod-actioncam',
    name: '4K Action Camera Kit',
    code: 'BB-CAM-104',
    description:
      'Waterproof stabilized 4K60 action camera with helmet mount, chest strap, and 128GB high-speed microSD.',
    categoryId: 'cat-photography',
    categoryName: 'Photography',
    pricePerDay: 420,
    image: PHOTO_URLS.actionCam,
    totalUnits: 3,
    available: true,
    featured: false,
    condition: 'Mint',
    conditionNotes: 'Tempered glass lens protector applied; waterproof seals inspected.',
    createdAt: '2026-02-14T10:00:00.000Z',
  },
];

const SEED_PRODUCTS: ProductRecord[] = RAW_SEED_PRODUCTS.map((p) => ({
  ...p,
  ...DEFAULT_PROVIDER_INFO,
}));

const SEED_BUNDLES: BundleRecord[] = [
  {
    id: 'bnd-photography',
    name: 'Photography Kit',
    code: 'BB-KIT-01',
    description:
      'Everything needed for portraits, campus events, and short films in one ready-to-shoot bundle.',
    image: PHOTO_URLS.dslr,
    productIds: ['prod-dslr', 'prod-tripod'],
    bundlePricePerDay: 550,
    featured: true,
    createdAt: '2026-02-15T10:00:00.000Z',
  },
  {
    id: 'bnd-camping',
    name: 'Camping Kit',
    code: 'BB-KIT-02',
    description:
      'Complete weekend outdoor shelter bundle combining our weatherproof dome tent and thermal sleeping bag.',
    image: PHOTO_URLS.camping,
    productIds: ['prod-camping', 'prod-sleeping-bag'],
    bundlePricePerDay: 520,
    featured: true,
    createdAt: '2026-02-16T10:00:00.000Z',
  },
  {
    id: 'bnd-presentation',
    name: 'Presentation Kit',
    code: 'BB-KIT-03',
    description:
      'High-brightness Full HD projector paired with a 120W PA speaker & wireless mics for auditoriums and demos.',
    image: PHOTO_URLS.projector,
    productIds: ['prod-projector', 'prod-speaker'],
    bundlePricePerDay: 1050,
    featured: true,
    createdAt: '2026-02-17T10:00:00.000Z',
  },
];

let mongoDb: Db | null = null;
let mongoClient: MongoClient | null = null;
let memoryState: DatabaseSchema | null = null;

function createInitialSchema(): DatabaseSchema {
  return {
    users: [],
    categories: [...SEED_CATEGORIES],
    products: [...SEED_PRODUCTS],
    bundles: [...SEED_BUNDLES],
    orders: [],
    conditionReports: [],
    carts: {},
    tokenSessions: {},
  };
}

function normalizeUserRecord(u: UserRecord): UserRecord {
  return {
    ...u,
    providerStatus: u.providerStatus || (u.role === 'provider' ? 'approved' : 'none'),
  };
}

function normalizeProductRecord(p: ProductRecord): ProductRecord {
  return {
    ...p,
    image: upgradeLegacyImage(p.image),
    condition: p.condition || 'Good',
    conditionNotes: p.conditionNotes || 'Inspected and ready for rental.',
    providerId: p.providerId || DEFAULT_PROVIDER_INFO.providerId,
    providerName: p.providerName || DEFAULT_PROVIDER_INFO.providerName,
    providerCity: p.providerCity || DEFAULT_PROVIDER_INFO.providerCity,
    providerBio: p.providerBio || DEFAULT_PROVIDER_INFO.providerBio,
    approvalStatus: p.approvalStatus || 'approved',
  };
}

function loadLocalData(): DatabaseSchema {
  if (memoryState) return memoryState;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    memoryState = createInitialSchema();
    saveLocalData();
    return memoryState;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
    memoryState = {
      users: Array.isArray(parsed.users) ? parsed.users.map(normalizeUserRecord) : [],
      categories:
        Array.isArray(parsed.categories) && parsed.categories.length > 0
          ? parsed.categories
          : [...SEED_CATEGORIES],
      products:
        Array.isArray(parsed.products) && parsed.products.length > 0
          ? parsed.products.map(normalizeProductRecord)
          : [...SEED_PRODUCTS],
      bundles:
        Array.isArray(parsed.bundles) && parsed.bundles.length > 0
          ? parsed.bundles
          : [...SEED_BUNDLES],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      conditionReports: Array.isArray(parsed.conditionReports) ? parsed.conditionReports : [],
      carts: parsed.carts && typeof parsed.carts === 'object' ? parsed.carts : {},
      tokenSessions:
        parsed.tokenSessions && typeof parsed.tokenSessions === 'object' ? parsed.tokenSessions : {},
    };
  } catch {
    memoryState = createInitialSchema();
    saveLocalData();
  }
  return memoryState;
}

function saveLocalData(): void {
  if (!memoryState) return;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tempPath = `${DATA_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(memoryState, null, 2), 'utf8');
  fs.renameSync(tempPath, DATA_FILE);
}

export async function initDatabase(): Promise<{ mode: 'mongodb' | 'local-json' }> {
  const mongoUri = process.env.MONGODB_URI?.trim();
  if (mongoUri) {
    try {
      mongoClient = new MongoClient(mongoUri);
      await mongoClient.connect();
      mongoDb = mongoClient.db();

      const catCount = await mongoDb.collection('categories').countDocuments();
      if (catCount === 0) {
        await mongoDb.collection('categories').insertMany(SEED_CATEGORIES.map((c) => ({ ...c })));
      }
      const prodCount = await mongoDb.collection('products').countDocuments();
      if (prodCount === 0) {
        await mongoDb.collection('products').insertMany(SEED_PRODUCTS.map((p) => ({ ...p })));
      }
      const bundleCount = await mongoDb.collection('bundles').countDocuments();
      if (bundleCount === 0) {
        await mongoDb.collection('bundles').insertMany(SEED_BUNDLES.map((b) => ({ ...b })));
      }
      await ensureInitialAdminFromEnv();
      console.log('[BorrowBox DB] Connected to MongoDB.');
      return { mode: 'mongodb' };
    } catch (err) {
      console.warn(
        '[BorrowBox DB] MongoDB connection failed, falling back to local JSON store:',
        err instanceof Error ? err.message : String(err),
      );
      mongoDb = null;
      mongoClient = null;
    }
  }

  loadLocalData();
  await ensureInitialAdminFromEnv();
  console.log('[BorrowBox DB] Using persistent local JSON store at ./data/borrowbox.json.');
  return { mode: 'local-json' };
}

export async function ensureInitialAdminFromEnv(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!adminEmail || !adminPassword) return;

  const existing = await findUserByEmail(adminEmail);
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  if (existing) {
    if (mongoDb) {
      await mongoDb
        .collection<UserRecord>('users')
        .updateOne({ id: existing.id }, { $set: { role: 'admin', passwordHash } });
    } else {
      const db = loadLocalData();
      const idx = db.users.findIndex((u) => u.id === existing.id);
      if (idx !== -1) {
        db.users[idx].role = 'admin';
        db.users[idx].passwordHash = passwordHash;
        saveLocalData();
      }
    }
    return;
  }

  await createUser({
    fullName: 'BorrowBox Administrator',
    email: adminEmail,
    phone: '+910000000000',
    passwordHash,
    role: 'admin',
    authProvider: 'email',
  });
}

export async function hasAnyAdmin(): Promise<boolean> {
  if (mongoDb) {
    const count = await mongoDb.collection<UserRecord>('users').countDocuments({ role: 'admin' });
    return count > 0;
  }
  const db = loadLocalData();
  return db.users.some((u) => u.role === 'admin');
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  if (mongoDb) {
    const doc = await mongoDb.collection<UserRecord>('users').findOne({ email: normalized });
    return doc ? normalizeUserRecord(doc) : null;
  }
  const db = loadLocalData();
  const found = db.users.find((u) => u.email.toLowerCase() === normalized);
  return found ? normalizeUserRecord(found) : null;
}

export async function findUserByPhone(phone: string): Promise<UserRecord | null> {
  const normalized = phone.trim();
  if (!normalized) return null;
  if (mongoDb) {
    const doc = await mongoDb.collection<UserRecord>('users').findOne({ phone: normalized });
    return doc ? normalizeUserRecord(doc) : null;
  }
  const db = loadLocalData();
  const found = db.users.find((u) => u.phone === normalized);
  return found ? normalizeUserRecord(found) : null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  if (mongoDb) {
    const doc = await mongoDb.collection<UserRecord>('users').findOne({ id });
    return doc ? normalizeUserRecord(doc) : null;
  }
  const db = loadLocalData();
  const found = db.users.find((u) => u.id === id);
  return found ? normalizeUserRecord(found) : null;
}

export async function createUser(input: {
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string | null;
  role: UserRole;
  authProvider: AuthProvider;
  googleId?: string;
}): Promise<UserRecord> {
  const user: UserRecord = {
    id: `usr-${crypto.randomUUID()}`,
    fullName: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    passwordHash: input.passwordHash,
    role: input.role,
    authProvider: input.authProvider,
    googleId: input.googleId,
    providerStatus: input.role === 'provider' ? 'approved' : 'none',
    createdAt: new Date().toISOString(),
  };
  if (mongoDb) {
    await mongoDb.collection<UserRecord>('users').insertOne({ ...user });
  } else {
    const db = loadLocalData();
    db.users.push(user);
    saveLocalData();
  }
  return user;
}

export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  if (mongoDb) {
    await mongoDb
      .collection<UserRecord>('users')
      .updateOne({ id: userId }, { $set: { passwordHash } });
    return;
  }
  const db = loadLocalData();
  const user = db.users.find((u) => u.id === userId);
  if (user) {
    user.passwordHash = passwordHash;
    saveLocalData();
  }
}

export async function updateUserProviderState(
  userId: string,
  updates: {
    role?: UserRole;
    providerStatus: ProviderStatus;
    providerProfile: ProviderProfile;
  },
): Promise<UserRecord | null> {
  const existing = await findUserById(userId);
  if (!existing) return null;
  const nextRole: UserRole = updates.role ?? existing.role;
  const updated: UserRecord = {
    ...existing,
    role: nextRole,
    providerStatus: updates.providerStatus,
    providerProfile: updates.providerProfile,
  };
  if (mongoDb) {
    await mongoDb.collection<UserRecord>('users').updateOne(
      { id: userId },
      {
        $set: {
          role: updated.role,
          providerStatus: updated.providerStatus,
          providerProfile: updated.providerProfile,
        },
      },
    );
    await mongoDb
      .collection<ProductRecord>('products')
      .updateMany(
        { providerId: userId },
        {
          $set: {
            providerName: updated.providerProfile?.businessName || existing.fullName,
            providerCity: updated.providerProfile?.city || 'Campus Hub',
            providerBio: updated.providerProfile?.bio || '',
          },
        },
      );
  } else {
    const db = loadLocalData();
    const idx = db.users.findIndex((u) => u.id === userId);
    if (idx !== -1) db.users[idx] = updated;
    for (const p of db.products) {
      if (p.providerId === userId) {
        p.providerName = updated.providerProfile?.businessName || existing.fullName;
        p.providerCity = updated.providerProfile?.city || 'Campus Hub';
        p.providerBio = updated.providerProfile?.bio || '';
      }
    }
    saveLocalData();
  }
  return updated;
}

export async function listCustomers(): Promise<UserRecord[]> {
  if (mongoDb) {
    const rows = await mongoDb
      .collection<UserRecord>('users')
      .find({ role: { $in: ['customer', 'provider'] } })
      .sort({ createdAt: -1 })
      .toArray();
    return rows.map(normalizeUserRecord);
  }
  const db = loadLocalData();
  return db.users
    .filter((u) => u.role === 'customer' || u.role === 'provider')
    .map(normalizeUserRecord)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listProvidersAndApplicants(): Promise<UserRecord[]> {
  if (mongoDb) {
    const rows = await mongoDb
      .collection<UserRecord>('users')
      .find({
        role: { $ne: 'admin' },
        $or: [{ role: 'provider' }, { providerStatus: { $in: ['pending', 'approved', 'rejected'] } }],
      })
      .sort({ createdAt: -1 })
      .toArray();
    return rows.map(normalizeUserRecord);
  }
  const db = loadLocalData();
  return db.users
    .filter(
      (u) =>
        u.role !== 'admin' &&
        (u.role === 'provider' ||
          u.providerStatus === 'pending' ||
          u.providerStatus === 'approved' ||
          u.providerStatus === 'rejected'),
    )
    .map(normalizeUserRecord)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listCategories(): Promise<CategoryRecord[]> {
  if (mongoDb) {
    const rows = await mongoDb.collection<CategoryRecord>('categories').find().sort({ createdAt: 1 }).toArray();
    return rows.map((c) => ({ ...c, image: upgradeLegacyImage(c.image) }));
  }
  const db = loadLocalData();
  return [...db.categories]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((c) => ({ ...c, image: upgradeLegacyImage(c.image) }));
}

export async function getCategoryById(id: string): Promise<CategoryRecord | null> {
  if (mongoDb) {
    const doc = await mongoDb.collection<CategoryRecord>('categories').findOne({ id });
    return doc ? { ...doc, image: upgradeLegacyImage(doc.image) } : null;
  }
  const db = loadLocalData();
  const found = db.categories.find((c) => c.id === id);
  return found ? { ...found, image: upgradeLegacyImage(found.image) } : null;
}

export async function createCategory(input: {
  name: string;
  description: string;
  image?: string;
}): Promise<CategoryRecord> {
  const slug = input.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const category: CategoryRecord = {
    id: `cat-${crypto.randomUUID().slice(0, 8)}`,
    name: input.name.trim(),
    slug: slug || `category-${Date.now()}`,
    description: input.description.trim(),
    image: input.image?.trim() || 'images/category-default.jpg',
    createdAt: new Date().toISOString(),
  };
  if (mongoDb) {
    await mongoDb.collection<CategoryRecord>('categories').insertOne({ ...category });
  } else {
    const db = loadLocalData();
    db.categories.push(category);
    saveLocalData();
  }
  return category;
}

export async function updateCategory(
  id: string,
  updates: { name: string; description: string; image?: string },
): Promise<CategoryRecord | null> {
  const existing = await getCategoryById(id);
  if (!existing) return null;
  const newName = updates.name.trim();
  const slug = newName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const updated: CategoryRecord = {
    ...existing,
    name: newName,
    slug: slug || existing.slug,
    description: updates.description.trim(),
    image: updates.image?.trim() || existing.image,
  };
  if (mongoDb) {
    await mongoDb.collection<CategoryRecord>('categories').updateOne({ id }, { $set: updated });
    await mongoDb
      .collection<ProductRecord>('products')
      .updateMany({ categoryId: id }, { $set: { categoryName: newName } });
  } else {
    const db = loadLocalData();
    const idx = db.categories.findIndex((c) => c.id === id);
    if (idx !== -1) db.categories[idx] = updated;
    for (const p of db.products) {
      if (p.categoryId === id) p.categoryName = newName;
    }
    saveLocalData();
  }
  return updated;
}

export async function deleteCategory(id: string): Promise<{ ok: boolean; reason?: string }> {
  const products = await listProducts();
  const inUse = products.some((p) => p.categoryId === id);
  if (inUse) {
    return {
      ok: false,
      reason: 'Cannot delete a category that still has assigned products. Reassign or delete those products first.',
    };
  }
  if (mongoDb) {
    await mongoDb.collection<CategoryRecord>('categories').deleteOne({ id });
  } else {
    const db = loadLocalData();
    db.categories = db.categories.filter((c) => c.id !== id);
    saveLocalData();
  }
  return { ok: true };
}

export async function listProducts(options?: {
  onlyApproved?: boolean;
  providerId?: string;
}): Promise<ProductRecord[]> {
  let rows: ProductRecord[];
  if (mongoDb) {
    rows = await mongoDb.collection<ProductRecord>('products').find().sort({ createdAt: -1 }).toArray();
  } else {
    const db = loadLocalData();
    rows = [...db.products].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  let normalized = rows.map(normalizeProductRecord);
  if (options?.onlyApproved) {
    normalized = normalized.filter((p) => p.approvalStatus === 'approved');
  }
  if (options?.providerId) {
    normalized = normalized.filter((p) => p.providerId === options.providerId);
  }
  return normalized;
}

export async function getProductById(id: string): Promise<ProductRecord | null> {
  if (mongoDb) {
    const doc = await mongoDb.collection<ProductRecord>('products').findOne({ id });
    return doc ? normalizeProductRecord(doc) : null;
  }
  const db = loadLocalData();
  const found = db.products.find((p) => p.id === id);
  return found ? normalizeProductRecord(found) : null;
}

export async function createProduct(input: {
  name: string;
  code: string;
  description: string;
  categoryId: string;
  categoryName: string;
  pricePerDay: number;
  image: string;
  totalUnits: number;
  available: boolean;
  featured: boolean;
  condition?: ProductCondition;
  conditionNotes?: string;
  providerId?: string;
  providerName?: string;
  providerCity?: string;
  providerBio?: string;
  approvalStatus?: ListingApprovalStatus;
  approvalNote?: string;
}): Promise<ProductRecord> {
  const product: ProductRecord = {
    id: `prod-${crypto.randomUUID().slice(0, 8)}`,
    name: input.name.trim(),
    code: input.code.trim().toUpperCase(),
    description: input.description.trim(),
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    pricePerDay: Number(input.pricePerDay),
    image: input.image.trim(),
    totalUnits: Math.max(1, Math.floor(Number(input.totalUnits))),
    available: Boolean(input.available),
    featured: Boolean(input.featured),
    condition: input.condition || 'Mint',
    conditionNotes: input.conditionNotes?.trim() || 'Inspected and ready for rental.',
    providerId: input.providerId || DEFAULT_PROVIDER_INFO.providerId,
    providerName: input.providerName?.trim() || DEFAULT_PROVIDER_INFO.providerName,
    providerCity: input.providerCity?.trim() || DEFAULT_PROVIDER_INFO.providerCity,
    providerBio: input.providerBio?.trim() || DEFAULT_PROVIDER_INFO.providerBio,
    approvalStatus: input.approvalStatus || 'approved',
    approvalNote: input.approvalNote?.trim(),
    createdAt: new Date().toISOString(),
  };
  if (mongoDb) {
    await mongoDb.collection<ProductRecord>('products').insertOne({ ...product });
  } else {
    const db = loadLocalData();
    db.products.unshift(product);
    saveLocalData();
  }
  return product;
}

export async function updateProduct(
  id: string,
  updates: Partial<Omit<ProductRecord, 'id' | 'createdAt'>>,
): Promise<ProductRecord | null> {
  const existing = await getProductById(id);
  if (!existing) return null;
  const updated: ProductRecord = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
  };
  if (mongoDb) {
    await mongoDb.collection<ProductRecord>('products').updateOne({ id }, { $set: updated });
  } else {
    const db = loadLocalData();
    const idx = db.products.findIndex((p) => p.id === id);
    if (idx !== -1) {
      db.products[idx] = updated;
      saveLocalData();
    }
  }
  return updated;
}

export async function deleteProduct(id: string): Promise<boolean> {
  if (mongoDb) {
    const res = await mongoDb.collection<ProductRecord>('products').deleteOne({ id });
    return res.deletedCount > 0;
  }
  const db = loadLocalData();
  const prevLen = db.products.length;
  db.products = db.products.filter((p) => p.id !== id);
  if (db.products.length !== prevLen) {
    saveLocalData();
    return true;
  }
  return false;
}

// -------------------- BUNDLES --------------------

export async function listBundles(): Promise<BundleRecord[]> {
  if (mongoDb) {
    const rows = await mongoDb.collection<BundleRecord>('bundles').find().sort({ createdAt: -1 }).toArray();
    return rows.map((b) => ({ ...b, image: upgradeLegacyImage(b.image) }));
  }
  const db = loadLocalData();
  return [...db.bundles]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((b) => ({ ...b, image: upgradeLegacyImage(b.image) }));
}

export async function getBundleById(id: string): Promise<BundleRecord | null> {
  if (mongoDb) {
    const doc = await mongoDb.collection<BundleRecord>('bundles').findOne({ id });
    return doc ? { ...doc, image: upgradeLegacyImage(doc.image) } : null;
  }
  const db = loadLocalData();
  const found = db.bundles.find((b) => b.id === id);
  return found ? { ...found, image: upgradeLegacyImage(found.image) } : null;
}

export async function createBundle(input: {
  name: string;
  code: string;
  description: string;
  image: string;
  productIds: string[];
  bundlePricePerDay: number;
  featured?: boolean;
}): Promise<BundleRecord> {
  const bundle: BundleRecord = {
    id: `bnd-${crypto.randomUUID().slice(0, 8)}`,
    name: input.name.trim(),
    code: input.code.trim().toUpperCase(),
    description: input.description.trim(),
    image: input.image.trim(),
    productIds: [...new Set(input.productIds)],
    bundlePricePerDay: Number(input.bundlePricePerDay),
    featured: input.featured ?? true,
    createdAt: new Date().toISOString(),
  };
  if (mongoDb) {
    await mongoDb.collection<BundleRecord>('bundles').insertOne({ ...bundle });
  } else {
    const db = loadLocalData();
    db.bundles.unshift(bundle);
    saveLocalData();
  }
  return bundle;
}

export async function updateBundle(
  id: string,
  updates: Partial<Omit<BundleRecord, 'id' | 'createdAt'>>,
): Promise<BundleRecord | null> {
  const existing = await getBundleById(id);
  if (!existing) return null;
  const updated: BundleRecord = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
  };
  if (mongoDb) {
    await mongoDb.collection<BundleRecord>('bundles').updateOne({ id }, { $set: updated });
  } else {
    const db = loadLocalData();
    const idx = db.bundles.findIndex((b) => b.id === id);
    if (idx !== -1) {
      db.bundles[idx] = updated;
      saveLocalData();
    }
  }
  return updated;
}

export async function deleteBundle(id: string): Promise<boolean> {
  if (mongoDb) {
    const res = await mongoDb.collection<BundleRecord>('bundles').deleteOne({ id });
    return res.deletedCount > 0;
  }
  const db = loadLocalData();
  const prevLen = db.bundles.length;
  db.bundles = db.bundles.filter((b) => b.id !== id);
  if (db.bundles.length !== prevLen) {
    saveLocalData();
    return true;
  }
  return false;
}

// -------------------- ORDERS --------------------

export async function listOrders(userId?: string): Promise<OrderRecord[]> {
  if (mongoDb) {
    const query = userId ? { userId } : {};
    return await mongoDb.collection<OrderRecord>('orders').find(query).sort({ createdAt: -1 }).toArray();
  }
  const db = loadLocalData();
  const filtered = userId ? db.orders.filter((o) => o.userId === userId) : db.orders;
  return [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOrderById(id: string): Promise<OrderRecord | null> {
  if (mongoDb) {
    return (await mongoDb.collection<OrderRecord>('orders').findOne({ id })) ?? null;
  }
  const db = loadLocalData();
  return db.orders.find((o) => o.id === id) ?? null;
}

export async function createOrder(
  input: Omit<OrderRecord, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>,
): Promise<OrderRecord> {
  const now = new Date().toISOString();
  const rand = crypto.randomInt(100000, 999999);
  const order: OrderRecord = {
    ...input,
    id: `ord-${crypto.randomUUID().slice(0, 8)}`,
    orderNumber: `BB-${rand}`,
    createdAt: now,
    updatedAt: now,
  };
  if (mongoDb) {
    await mongoDb.collection<OrderRecord>('orders').insertOne({ ...order });
  } else {
    const db = loadLocalData();
    db.orders.unshift(order);
    saveLocalData();
  }
  return order;
}

export async function updateOrderStatus(id: string, orderStatus: OrderStatus): Promise<OrderRecord | null> {
  const existing = await getOrderById(id);
  if (!existing) return null;
  let paymentStatus = existing.paymentStatus;
  if (orderStatus === 'Cancelled' && existing.paymentStatus === 'Paid (Demo)') {
    paymentStatus = 'Refunded';
  } else if (orderStatus === 'Returned' && existing.paymentMethod === 'cod') {
    paymentStatus = 'Paid on Delivery';
  }
  const updatedItems = existing.items.map((item) => ({ ...item, itemStatus: orderStatus }));
  const updated: OrderRecord = {
    ...existing,
    items: updatedItems,
    orderStatus,
    paymentStatus,
    updatedAt: new Date().toISOString(),
  };
  if (mongoDb) {
    await mongoDb
      .collection<OrderRecord>('orders')
      .updateOne(
        { id },
        { $set: { orderStatus, paymentStatus, items: updatedItems, updatedAt: updated.updatedAt } },
      );
  } else {
    const db = loadLocalData();
    const idx = db.orders.findIndex((o) => o.id === id);
    if (idx !== -1) {
      db.orders[idx] = updated;
      saveLocalData();
    }
  }
  return updated;
}

export async function updateProviderOrderItemsStatus(
  orderId: string,
  providerId: string,
  nextStatus: OrderStatus,
): Promise<OrderRecord | null> {
  const existing = await getOrderById(orderId);
  if (!existing) return null;

  let touched = false;
  const updatedItems = existing.items.map((item) => {
    if (item.providerId === providerId) {
      touched = true;
      return { ...item, itemStatus: nextStatus };
    }
    return { ...item, itemStatus: item.itemStatus || existing.orderStatus };
  });

  if (!touched) return null;

  // Derive overall order status cleanly when all items share a status or progress
  const statuses = updatedItems.map((i) => i.itemStatus || existing.orderStatus);
  let overallStatus: OrderStatus = existing.orderStatus;
  if (statuses.every((s) => s === nextStatus)) {
    overallStatus = nextStatus;
  } else if (statuses.every((s) => s === 'Returned' || s === 'Cancelled')) {
    overallStatus = statuses.some((s) => s === 'Returned') ? 'Returned' : 'Cancelled';
  } else if (statuses.some((s) => s === 'Rented')) {
    overallStatus = 'Rented';
  } else if (statuses.some((s) => s === 'Ready for Pickup')) {
    overallStatus = 'Ready for Pickup';
  } else if (statuses.some((s) => s === 'Confirmed')) {
    overallStatus = 'Confirmed';
  }

  let paymentStatus = existing.paymentStatus;
  if (overallStatus === 'Cancelled' && existing.paymentStatus === 'Paid (Demo)') {
    paymentStatus = 'Refunded';
  } else if (overallStatus === 'Returned' && existing.paymentMethod === 'cod') {
    paymentStatus = 'Paid on Delivery';
  }

  const updated: OrderRecord = {
    ...existing,
    items: updatedItems,
    orderStatus: overallStatus,
    paymentStatus,
    updatedAt: new Date().toISOString(),
  };

  if (mongoDb) {
    await mongoDb
      .collection<OrderRecord>('orders')
      .updateOne(
        { id: orderId },
        {
          $set: {
            items: updatedItems,
            orderStatus: overallStatus,
            paymentStatus,
            updatedAt: updated.updatedAt,
          },
        },
      );
  } else {
    const db = loadLocalData();
    const idx = db.orders.findIndex((o) => o.id === orderId);
    if (idx !== -1) {
      db.orders[idx] = updated;
      saveLocalData();
    }
  }
  return updated;
}

export function datesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA <= endB && startB <= endA;
}

export async function getReservedUnitsForRange(
  productId: string,
  startDate: string,
  endDate: string,
): Promise<number> {
  const orders = await listOrders();
  const activeStatuses = new Set<OrderStatus>([
    'Order Placed',
    'Confirmed',
    'Ready for Pickup',
    'Rented',
  ]);
  let reserved = 0;
  for (const order of orders) {
    if (!activeStatuses.has(order.orderStatus)) continue;
    for (const item of order.items) {
      if (!datesOverlap(startDate, endDate, item.startDate, item.endDate)) continue;
      if (item.productId === productId) {
        reserved += item.quantity;
      } else if (Array.isArray(item.includedProductIds) && item.includedProductIds.includes(productId)) {
        reserved += item.quantity;
      }
    }
  }
  return reserved;
}

// -------------------- CONDITION REPORTS --------------------

export async function listConditionReports(userId?: string): Promise<ConditionReportRecord[]> {
  if (mongoDb) {
    const query = userId ? { userId } : {};
    return await mongoDb
      .collection<ConditionReportRecord>('condition_reports')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
  }
  const db = loadLocalData();
  const filtered = userId
    ? db.conditionReports.filter((r) => r.userId === userId)
    : db.conditionReports;
  return [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getConditionReportById(id: string): Promise<ConditionReportRecord | null> {
  if (mongoDb) {
    return (await mongoDb.collection<ConditionReportRecord>('condition_reports').findOne({ id })) ?? null;
  }
  const db = loadLocalData();
  return db.conditionReports.find((r) => r.id === id) ?? null;
}

export async function createConditionReport(input: {
  orderId: string;
  orderNumber: string;
  productId: string;
  productName: string;
  providerId?: string;
  providerName?: string;
  userId: string;
  customerName: string;
  reportedCondition: ReturnReportedCondition;
  customerNotes: string;
  photos: string[];
}): Promise<ConditionReportRecord> {
  const damageDetected = input.reportedCondition === 'Damaged';
  const report: ConditionReportRecord = {
    id: `rep-${crypto.randomUUID().slice(0, 8)}`,
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    productId: input.productId,
    productName: input.productName,
    providerId: input.providerId || DEFAULT_PROVIDER_INFO.providerId,
    providerName: input.providerName || DEFAULT_PROVIDER_INFO.providerName,
    userId: input.userId,
    customerName: input.customerName,
    reportedCondition: input.reportedCondition,
    customerNotes: input.customerNotes.trim(),
    photos: input.photos,
    damageDetected,
    adminStatus: 'Pending Review',
    adminNotes: '',
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  };
  if (mongoDb) {
    await mongoDb.collection<ConditionReportRecord>('condition_reports').insertOne({ ...report });
  } else {
    const db = loadLocalData();
    db.conditionReports.unshift(report);
    saveLocalData();
  }
  return report;
}

export async function reviewConditionReport(
  id: string,
  updates: {
    adminStatus: ReportReviewStatus;
    damageDetected: boolean;
    adminNotes: string;
  },
): Promise<ConditionReportRecord | null> {
  const existing = await getConditionReportById(id);
  if (!existing) return null;
  const updated: ConditionReportRecord = {
    ...existing,
    adminStatus: updates.adminStatus,
    damageDetected: updates.damageDetected,
    adminNotes: updates.adminNotes.trim(),
    reviewedAt: new Date().toISOString(),
  };
  if (mongoDb) {
    await mongoDb
      .collection<ConditionReportRecord>('condition_reports')
      .updateOne({ id }, { $set: updated });
  } else {
    const db = loadLocalData();
    const idx = db.conditionReports.findIndex((r) => r.id === id);
    if (idx !== -1) {
      db.conditionReports[idx] = updated;
      saveLocalData();
    }
  }
  return updated;
}

// -------------------- CART & AUTH SESSIONS --------------------

export async function getCartForUser(userId: string): Promise<CartItemRecord[]> {
  if (mongoDb) {
    const doc = await mongoDb
      .collection<{ userId: string; items: CartItemRecord[] }>('carts')
      .findOne({ userId });
    return doc?.items ?? [];
  }
  const db = loadLocalData();
  return db.carts[userId] ? [...db.carts[userId]] : [];
}

export async function saveCartForUser(userId: string, items: CartItemRecord[]): Promise<void> {
  if (mongoDb) {
    await mongoDb
      .collection<{ userId: string; items: CartItemRecord[] }>('carts')
      .updateOne({ userId }, { $set: { userId, items } }, { upsert: true });
    return;
  }
  const db = loadLocalData();
  db.carts[userId] = [...items];
  saveLocalData();
}

export async function getTokenSession(token: string): Promise<AppTokenSession | null> {
  if (!token) return null;
  if (mongoDb) {
    const doc = await mongoDb.collection<AppTokenSession>('token_sessions').findOne({ token });
    if (!doc) return null;
    if (doc.expiresAt < Date.now()) {
      await mongoDb.collection<AppTokenSession>('token_sessions').deleteOne({ token });
      return null;
    }
    return doc;
  }
  const db = loadLocalData();
  const s = db.tokenSessions[token];
  if (!s) return null;
  if (s.expiresAt < Date.now()) {
    delete db.tokenSessions[token];
    saveLocalData();
    return null;
  }
  return s;
}

export async function saveTokenSession(session: AppTokenSession): Promise<void> {
  if (mongoDb) {
    await mongoDb
      .collection<AppTokenSession>('token_sessions')
      .updateOne({ token: session.token }, { $set: session }, { upsert: true });
    return;
  }
  const db = loadLocalData();
  db.tokenSessions[session.token] = session;
  saveLocalData();
}

export async function deleteTokenSession(token: string): Promise<void> {
  if (!token) return;
  if (mongoDb) {
    await mongoDb.collection<AppTokenSession>('token_sessions').deleteOne({ token });
    return;
  }
  const db = loadLocalData();
  delete db.tokenSessions[token];
  saveLocalData();
}
