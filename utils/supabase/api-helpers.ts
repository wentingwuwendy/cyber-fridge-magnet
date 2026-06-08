import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from './server'

export async function getAuthenticatedUser(request: NextRequest) {
  // Check user ID from middleware-set header
  const userId = request.headers.get('x-user-id')
  const email = request.headers.get('x-user-email')
  
  if (!userId || !email) {
    return null
  }
  
  return { id: userId, email }
}

export async function requireAuth(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  return user
}

export async function uploadToSupabaseStorage(
  bucket: string,
  path: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  const supabase = await createAdminClient()
  
  const { data: uploadData, error } = await supabase
    .storage
    .from(bucket)
    .upload(path, data, {
      contentType,
      cacheControl: '3600',
      upsert: true,
    })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  // Get public URL
  const { data: { publicUrl } } = supabase
    .storage
    .from(bucket)
    .getPublicUrl(uploadData.path)

  return publicUrl
}

export async function deleteFromSupabaseStorage(
  bucket: string,
  path: string
): Promise<void> {
  const supabase = await createAdminClient()
  await supabase.storage.from(bucket).remove([path])
}
