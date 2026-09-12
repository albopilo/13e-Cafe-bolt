import type { OrderStatus, PaymentStatus } from '@/lib/types';
import { useLang } from '@/context/LanguageContext';
import type { TranslationKey } from '@/lib/translations';

export function StatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useLang();
  const styles: Record<OrderStatus, string> = {
    pending: 'bg-amber-100 text-amber-600',
    preparing: 'bg-blue-100 text-blue-600',
    served: 'bg-sage-100 text-sage-600',
    cancelled: 'bg-rust-100 text-rust-500',
  };
  const labelKeys: Record<OrderStatus, TranslationKey> = {
    pending: 'pending',
    preparing: 'preparing',
    served: 'served',
    cancelled: 'cancelled',
  };
  return <span className={`badge ${styles[status]} capitalize`}>{t(labelKeys[status])}</span>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { t } = useLang();
  const styles: Record<PaymentStatus, string> = {
    'awaiting-proof': 'bg-amber-100 text-amber-600',
    'paid': 'bg-sage-100 text-sage-600',
    'none': 'bg-cream-200 text-espresso-400',
  };
  const labelKeys: Record<PaymentStatus, TranslationKey> = {
    'awaiting-proof': 'awaitingProof',
    'paid': 'paid',
    'none': 'noPayment',
  };
  return <span className={`badge ${styles[status]}`}>{t(labelKeys[status])}</span>;
}
