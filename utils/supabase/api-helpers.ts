import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function createApiClient(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {
          // read-only in API routes
        },
      },
    }
  )
}

export async function getAuthenticatedUser(request: NextRequest) {
  try {
    const supabase = createApiClient(request)
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null
    return { id: user.id, email: user.email || '' }
  } catch {
    return null
  }
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
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

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
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  await supabase.storage.from(bucket).remove([path])
}
