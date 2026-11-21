export type UserRole = 'customer' | 'provider' | 'admin';
export type ProviderStatus = 'none' | 'pending' | 'approved' | 'rejected';
export type ListingApprovalStatus = 'pending' | 'approved' | 'rejected';
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

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  authProvider: 'email' | 'phone' | 'google';
  providerStatus: ProviderStatus;
  providerProfile?: ProviderProfile;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  createdAt: string;
  productCount?: number;
}

export interface Product {
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

export interface Bundle {
  id: string;
  name: string;
  code: string;
  description: string;
  image: string;
  productIds: string[];
  products: Product[];
  individualTotalPerDay: number;
  bundlePricePerDay: number;
  savingsPerDay: number;
  available: boolean;
  availableUnits: number;
  featured: boolean;
  createdAt: string;
}

export interface CartItem {
  id: string;
  isBundle: boolean;
  productId: string;
  bundleId?: string;
  includedProductNames?: string[];
  productName: string;
  productCode: string;
  productImage: string;
  categoryName: string;
  pricePerDay: number;
  startDate: string;
  endDate: string;
  days: number;
  quantity: number;
  totalUnits: number;
  lineTotal: number;
}

export interface CartSummary {
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
}

export type OrderStatus =
  | 'Order Placed'
  | 'Confirmed'
  | 'Ready for Pickup'
  | 'Rented'
  | 'Returned'
  | 'Cancelled';

export interface OrderItem {
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

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  city: string;
  pinCode: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  paymentMethod: 'cod' | 'demo_online';
  paymentStatus: 'Pending' | 'Paid (Demo)' | 'Paid on Delivery' | 'Refunded';
  transactionRef: string | null;
  orderStatus: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ConditionReport {
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

export interface CustomerSummary {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  providerStatus: ProviderStatus;
  businessName?: string;
  authProvider: string;
  createdAt: string;
  orderCount: number;
}

export interface ProviderSummary extends User {
  listingCount: number;
  approvedListingCount: number;
}

export interface ProviderOverview {
  stats: {
    totalListings: number;
    approvedListings: number;
    pendingListings: number;
    rejectedListings: number;
    bookingRequestsCount: number;
    activeRentalsCount: number;
    totalOrders: number;
    pendingReports: number;
    totalEarnings: number;
  };
}

export interface AdminOverview {
  stats: {
    totalProducts: number;
    availableProducts: number;
    pendingListingApprovals: number;
    totalProviders: number;
    pendingProviders: number;
    totalCustomers: number;
    totalOrders: number;
    pendingOrders: number;
    totalCategories: number;
    totalBundles: number;
    pendingReports: number;
    totalRevenue: number;
  };
  newArrivals: Product[];
  recentOrders: Order[];
}

export type AppRoute =
  | '/'
  | '/products'
  | '/cart'
  | '/orders'
  | '/become-provider'
  | '/provider'
  | '/login'
  | '/signup'
  | '/admin-login'
  | '/admin';
