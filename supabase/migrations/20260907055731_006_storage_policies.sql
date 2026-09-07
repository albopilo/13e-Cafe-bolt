/*
# Create storage bucket policies for payment-proofs

## Overview
The payment-proofs bucket was created via SQL. This migration adds storage policies
so that authenticated users can upload payment proof images, and anyone can view them
(since they are public proofs that staff need to verify).

## Security
- SELECT (read): public — anyone can view a payment proof URL (needed for staff verification)
- INSERT (upload): authenticated only — only logged-in users can upload proofs
*/

DROP POLICY IF EXISTS "public_read_payment_proofs" ON storage.objects;
CREATE POLICY "public_read_payment_proofs" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "auth_insert_payment_proofs" ON storage.objects;
CREATE POLICY "auth_insert_payment_proofs" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'payment-proofs');
