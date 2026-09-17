-- Enable realtime on orders table so the StaffDashboard and guest OrderHistoryPage
-- receive postgres_changes events without needing a page refresh.
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Also enable on order_status_history so status change events propagate.
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_history;
