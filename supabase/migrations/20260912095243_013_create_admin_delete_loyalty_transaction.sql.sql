/*
# Create admin_delete_loyalty_transaction function

## Overview
Creates a SECURITY DEFINER RPC function that deletes a loyalty transaction and
reverses its effect on the member's spending, points, and tier.

## Problem
The frontend calls `admin_delete_loyalty_transaction` via supabase.rpc() when
an admin deletes a transaction from the member detail modal. However, this
function did not exist in the database, so the call failed. Additionally, the
existing delete-transaction edge function reversed spending/points but never
recalculated the tier — so a member who was upgraded by a deleted transaction
stayed at the higher tier incorrectly.

## What this function does
1. Verifies the caller is an admin (via auth.uid()).
2. Fetches the transaction to delete.
3. Reverses the transaction's effect on the member:
   - Subtracts amount from spending_since_upgrade, monthly_since_upgrade, yearly_since_upgrade.
   - Subtracts points_earned from redeemable_points.
4. Recalculates the member's tier based on the new spending_since_upgrade value,
   using the tier threshold defaults from the settings migration:
   - Classic: 0
   - Bronze: classic_to_bronze_monthly (100,000) — monthly spending
   - Silver: bronze_to_silver_yearly (1,000,000) — yearly spending
   - Gold: silver_to_gold_yearly / gold_stay_yearly (3,000,000 / 5,000,000) — yearly spending
   If the tier changes (downgrade), resets spending_since_upgrade, monthly_since_upgrade,
   yearly_since_upgrade to 0 and updates discount_rate and upgrade_date.
5. Deletes the loyalty transaction.
6. If the transaction references an order, deletes that order too (cascading to
   order_status_history and voucher_redemptions).

## Security
- SECURITY DEFINER: runs with the function owner's privileges so it can modify
  members and loyalty_transactions regardless of RLS.
- Admin-only: the function body checks that the caller exists in the admins table.
- Returns JSON: { success: boolean, error?: string }
*/

CREATE OR REPLACE FUNCTION public.admin_delete_loyalty_transaction(p_transaction_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx RECORD;
  v_member RECORD;
  v_new_spending integer;
  v_new_monthly integer;
  v_new_yearly integer;
  v_new_points integer;
  v_new_tier text;
  v_tier_changed boolean;
  v_discount_rate numeric;
BEGIN
  -- Verify caller is an admin
  IF NOT EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  -- Fetch the transaction
  SELECT * INTO v_tx FROM loyalty_transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Transaction not found');
  END IF;

  -- Fetch the member
  SELECT * INTO v_member FROM members WHERE user_id = v_tx.member_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Member not found');
  END IF;

  -- Reverse the transaction's effect
  v_new_spending := GREATEST(0, v_member.spending_since_upgrade - COALESCE(v_tx.amount, 0));
  v_new_monthly := GREATEST(0, v_member.monthly_since_upgrade - COALESCE(v_tx.amount, 0));
  v_new_yearly := GREATEST(0, v_member.yearly_since_upgrade - COALESCE(v_tx.amount, 0));
  v_new_points := GREATEST(0, v_member.redeemable_points - COALESCE(v_tx.points_earned, 0));

  -- Recalculate tier based on new spending
  -- Tier thresholds use yearly_since_upgrade for Silver/Gold and monthly for Bronze
  -- Defaults from migration 011 (settings table):
  --   classic_to_bronze_monthly = 100000
  --   bronze_to_silver_yearly   = 1000000
  --   silver_to_gold_yearly     = 3000000
  --   gold_stay_yearly          = 5000000
  v_new_tier := v_member.tier;

  IF v_new_yearly >= 5000000 THEN
    v_new_tier := 'Gold';
  ELSIF v_new_yearly >= 3000000 THEN
    -- Silver requires 3,000,000 yearly. But if already Gold and spending >= 3,000,000 but < 5,000,000,
    -- they drop to Silver.
    v_new_tier := 'Silver';
  ELSIF v_new_yearly >= 1000000 THEN
    v_new_tier := 'Bronze';
  ELSIF v_new_monthly >= 100000 THEN
    v_new_tier := 'Bronze';
  ELSE
    v_new_tier := 'Classic';
  END IF;

  v_tier_changed := (v_new_tier <> v_member.tier);

  -- Determine discount rate for the new tier
  v_discount_rate := CASE v_new_tier
    WHEN 'Bronze' THEN 0.10
    WHEN 'Silver' THEN 0.15
    WHEN 'Gold' THEN 0.20
    ELSE 0
  END;

  -- Update member: reverse spending/points and adjust tier if changed
  IF v_tier_changed THEN
    -- Tier downgraded: reset spending counters and update tier fields
    UPDATE members SET
      spending_since_upgrade = 0,
      monthly_since_upgrade = 0,
      yearly_since_upgrade = 0,
      redeemable_points = v_new_points,
      tier = v_new_tier,
      discount_rate = v_discount_rate,
      upgrade_date = CURRENT_DATE
    WHERE user_id = v_tx.member_id;
  ELSE
    -- Same tier: just reverse the spending/points
    UPDATE members SET
      spending_since_upgrade = v_new_spending,
      monthly_since_upgrade = v_new_monthly,
      yearly_since_upgrade = v_new_yearly,
      redeemable_points = v_new_points
    WHERE user_id = v_tx.member_id;
  END IF;

  -- Delete the loyalty transaction
  DELETE FROM loyalty_transactions WHERE id = p_transaction_id;

  -- If the transaction referenced an order, delete the order (cascades to history/voucher_redemptions)
  IF v_tx.order_id IS NOT NULL THEN
    DELETE FROM orders WHERE id = v_tx.order_id;
  END IF;

  RETURN json_build_object('success', true, 'tier_changed', v_tier_changed, 'new_tier', v_new_tier);
END;
$$;

-- Grant execute to authenticated users (the function itself checks admin access)
GRANT EXECUTE ON FUNCTION public.admin_delete_loyalty_transaction(uuid) TO authenticated;
