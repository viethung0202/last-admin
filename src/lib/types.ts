export type User = {
  id: string
  email: string
  name: string
}

export type Role = 'OWNER' | 'STAFF'

export type Domain = {
  id: string
  hostname: string
  isPrimary: boolean
}

export type Store = {
  id: string
  slug: string
  name: string
  currency: string
  domains: Domain[]
  role: Role
  status?: 'ACTIVE' | 'SUSPENDED'
}

export type ProductCategory = {
  slug: string
  name: string
}

export type Collection = {
  id: string
  name: string
  slug: string
  _count?: { products: number }
}

export type ProductStatus = 'DRAFT' | 'ACTIVE'

export type Variant = {
  id: string
  sku: string | null
  price: string
  compareAtPrice: string | null
  stock: number
  optionValues: Record<string, string>
}

export type Product = {
  id: string
  name: string
  description: string | null
  vendor: string | null
  tags: string[]
  seoTitle: string | null
  seoDescription: string | null
  status: ProductStatus
  category: ProductCategory | null
  collections: Array<{ collection: Collection }>
  images: Array<{ id: string; url: string; alt: string | null; position: number }>
  options: Array<{ id: string; name: string; values: Array<{ id: string; value: string }> }>
  variants: Variant[]
}

export type OrderStatus = 'DRAFT' | 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'

export type Payment = {
  method: 'COD' | 'VNPAY'
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED'
}

export type Order = {
  id: string
  guestEmail: string | null
  guestName: string | null
  status: OrderStatus
  subtotal: string
  discountCode: string | null
  discountAmount: string
  note: string | null
  total: string
  createdAt: string
  items: Array<{
    id: string
    variantId: string | null
    productNameSnapshot: string
    variantLabelSnapshot: string
    unitPrice: string
    quantity: number
  }>
  payments: Payment[]
}

export type Customer = {
  id: string
  email: string
  name: string
  createdAt: string
  orderCount: number
  totalSpent: string
  lastOrderAt: string | null
}

export type Member = {
  userId: string
  role: Role
  user: User
}

export type PaymentMethods = { COD: boolean; VNPAY: boolean; vnpayAvailable: boolean }

// What every store page gets from App.
export type PageProps = {
  store: Store
  token: string
  notify: (message: string) => void
  // second hash segment, e.g. the product id in #/products/:id
  param?: string
}

export type Discount = {
  id: string
  code: string
  type: 'PERCENTAGE' | 'FIXED'
  value: string
  minSubtotal: string | null
  usageLimit: number | null
  usedCount: number
  startsAt: string | null
  endsAt: string | null
  active: boolean
}

export type PageSummary = {
  id: string
  slug: string
  title: string
  updatedAt: string
  publishedVersion: { id: string; version: number; createdAt: string } | null
}

export type PageDetail = PageSummary & {
  draft: unknown
  versions: Array<{ id: string; version: number; createdAt: string }>
}

export type PlatformStats = { stores: number; suspended: number; merchants: number; orders: number; templates: number }

export type PlatformStore = {
  id: string
  slug: string
  name: string
  currency: string
  status: 'ACTIVE' | 'SUSPENDED'
  createdAt: string
  owners: Array<{ email: string; name: string }>
  productCount: number
  orderCount: number
}

export type PlatformMerchant = {
  id: string
  email: string
  name: string
  createdAt: string
  stores: Array<{ slug: string; name: string; status: string; role: Role }>
}

export type TemplateSummary = {
  id: string
  name: string
  description: string | null
  category: string | null
  thumbnailUrl: string | null
  source?: 'PLATFORM' | 'AI'
  published?: boolean
  updatedAt?: string
}

export type TemplateDetail = TemplateSummary & { data: unknown }

export type VnpaySettings = { tmnCode: string; payUrl: string; hashSecretSet: boolean; envFallback: boolean }
