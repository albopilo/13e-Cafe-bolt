import type { OrderStatus, PaymentStatus } from '@/lib/types';

export function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    pending: 'bg-amber-100 text-amber-600',
    preparing: 'bg-blue-100 text-blue-600',
    served: 'bg-sage-100 text-sage-600',
    cancelled: 'bg-rust-100 text-rust-500',
  };
  return <span className={`badge ${styles[status]} capitalize`}>{status}</span>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const styles: Record<PaymentStatus, string> = {
    'awaiting-proof': 'bg-amber-100 text-amber-600',
    'paid': 'bg-sage-100 text-sage-600',
    'none': 'bg-cream-200 text-espresso-400',
  };
  const labels: Record<PaymentStatus, string> = {
    'awaiting-proof': 'Awaiting Proof',
    'paid': 'Paid',
    'none': 'No Payment',
  };
  return <span className={`badge ${styles[status]}`}>{labels[status]}</span>;
}
