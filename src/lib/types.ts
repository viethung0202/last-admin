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

export type Product = {
  id: string
  name: string
  description: string | null
  status: ProductStatus
  category: ProductCategory | null
  collections: Array<{ collection: Collection }>
  variants: Array<{
    id: string
    price: string
    stock: number
  }>
}

export type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'

export type Payment = {
  method: 'COD' | 'VNPAY'
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED'
}

export type Order = {
  id: string
  guestEmail: string | null
  guestName: string | null
  status: OrderStatus
  total: string
  createdAt: string
  items: Array<{
    id: string
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
}
