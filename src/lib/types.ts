export interface Product {
  id: string;
  name: string;
  category: string;
  variant_label: string;
  variant_names: string[];
  pos_sell_price: number;
  pos_hidden: boolean;
  photo_1: string | null;
  photo_2: string | null;
  photo_3: string | null;
  photo_4: string | null;
  photo_5: string | null;
  photo_6: string | null;
  photo_7: string | null;
  photo_8: string | null;
  photo_9: string | null;
  photo_10: string | null;
  olsera_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketingProgram {
  id: string;
  type: string;
  active: boolean;
  buy_product_ids: string[];
  free_product_id: string;
  free_qty: number;
  free_variant: string | null;
}

export type LoyaltyTier = 'Classic' | 'Bronze' | 'Silver' | 'Gold';

export interface Member {
  user_id: string;
  phone: string;
  email: string;
  name: string;
  name_lower: string;
  birthdate: string;
  birth_month: number | null;
  birth_day: number | null;
  ktp: string | null;
  tier: LoyaltyTier;
  discount_rate: number;
  tax_rate: number;
  redeemable_points: number;
  spending_since_upgrade: number;
  monthly_since_upgrade: number;
  yearly_since_upgrade: number;
  upgrade_date: string | null;
  daily_cashback_earned: number;
  daily_cashback_date: string | null;
  last_birthday_email_sent: string | null;
  welcomed: boolean;
  tier_restored_at: string | null;
  last_room_upgrade: string | null;
  created_at: string;
}

export interface OrderItem {
  product_id: string;
  name: string;
  variant: string;
  price: number;
  quantity: number;
  is_promo?: boolean;
  promo_link_id?: string;
}

export type OrderStatus = 'pending' | 'preparing' | 'served' | 'cancelled';
export type PaymentMethod = 'cash' | 'qris';
export type PaymentStatus = 'awaiting-proof' | 'paid' | 'none';

export interface Order {
  id: string;
  member_id: string | null;
  table_name: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  delivery_fee: number;
  total: number;
  grand_total: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  proof_url: string | null;
  voucher_id: string | null;
  date: string;
  loyalty_recorded: boolean;
  loyalty_tx_id: string | null;
  phone: string | null;
  is_member: boolean;
  olsera_order_id: string | null;
  created_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  status: OrderStatus;
  changed_by: string | null;
  changed_at: string;
}

export interface Voucher {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  limit_per_day: number;
  active: boolean;
}

export interface VoucherRedemption {
  id: string;
  voucher_id: string;
  order_id: string;
  table_name: string;
  redeemed_at: string;
}

export interface LoyaltyTransaction {
  id: string;
  member_id: string;
  order_id: string | null;
  amount: number;
  cashback: number;
  points_earned: number;
  source: string;
  table_name: string;
  note: string | null;
  receipt_url: string | null;
  manual: boolean;
  created_at: string;
}

export interface StaffPushToken {
  id: string;
  user_id: string;
  token: string;
  role: string;
  created_at: string;
}

export type UserRole = 'member' | 'staff' | 'admin';

export interface StaffProfile {
  user_id: string;
  assigned_location: string;
  created_at: string;
}

export interface RoomUpgrade {
  id: string;
  member_id: string;
  claimed_at: string;
  location: string | null;
}

export interface Settings {
  id: number;
  classic_to_bronze_monthly: number;
  bronze_to_silver_monthly: number;
  bronze_to_silver_yearly: number;
  silver_to_gold_monthly: number;
  silver_to_gold_yearly: number;
  silver_stay_yearly: number;
  gold_stay_yearly: number;
  silver_cashback_rate: number;
  gold_cashback_rate: number;
  birthday_gold_cashback_rate: number;
  silver_daily_cashback_cap: number;
  gold_daily_cashback_cap: number;
  bronze_discount_rate: number;
  silver_discount_rate: number;
  gold_discount_rate: number;
  updated_at: string;
}

export interface CartItem {
  product_id: string;
  name: string;
  variant: string;
  price: number;
  quantity: number;
  is_promo: boolean;
  promo_link_id: string | null;
}
