-- RivoCity shared product image manager
-- One approved canonical image per universal product. Originals remain on the admin PC.
-- Public read is required because customer/vendor apps display catalogue images.
-- Only authenticated admins may upload, replace or delete objects in this bucket.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  2097152,
  ARRAY['image/webp', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view Rivo product images" ON storage.objects;
CREATE POLICY "Public can view Rivo product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Admins can upload Rivo product images" ON storage.objects;
CREATE POLICY "Admins can upload Rivo product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can update Rivo product images" ON storage.objects;
CREATE POLICY "Admins can update Rivo product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can delete Rivo product images" ON storage.objects;
CREATE POLICY "Admins can delete Rivo product images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.auth_user_id = auth.uid()
  )
);
