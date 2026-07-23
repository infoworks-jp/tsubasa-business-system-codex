export const PRODUCT_CATEGORIES = [
  "ラーメン",
  "トッピング",
  "ドリンク",
  "ご飯",
  "セット",
  "限定",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export type Product = {
  id: string;
  productCode: string;
  productName: string;
  category: ProductCategory;
  ticketButtonNumber: string | null;
  ticketDisplayPosition: string | null;
  salesStartDate: string;
  salesEndDate: string | null;
  standardPrice: number;
  futureCost: number | null;
  isActive: boolean;
  deactivationReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductPrice = {
  id: string;
  productId: string;
  price: number;
  validFrom: string;
  validTo: string | null;
  changeReason: string;
  createdAt: string;
};

export type ProductInput = Omit<
  Product,
  "id" | "createdAt" | "updatedAt" | "isActive" | "deactivationReason"
> & {
  isActive?: boolean;
  deactivationReason?: string | null;
  priceChangeReason?: string;
  priceValidFrom?: string;
};

export type ProductFilters = {
  search?: string;
  category?: ProductCategory | "";
  active?: "all" | "active" | "inactive";
  sortBy?: "code" | "name";
  sortDirection?: "asc" | "desc";
};
