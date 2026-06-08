import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, deleteFromSupabaseStorage } from '../../../../utils/supabase/api-helpers'
import { createAdminClient } from '../../../../utils/supabase/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request)
  if ('status' in user) return user as NextResponse

  const { id } = await params
  const magnetId = parseInt(id)

  const supabase = await createAdminClient()

  // Get magnet info
  const { data: magnet } = await supabase
    .from('magnets')
    .select('image_url')
    .eq('id', magnetId)
    .eq('user_id', user.id)
    .single()

  if (magnet?.image_url) {
    try {
      const urlParts = magnet.image_url.split('/magnets/')
      if (urlParts.length > 1) {
        await deleteFromSupabaseStorage('magnets', urlParts[1])
      }
    } catch {
      // ignore
    }
  }

  const { error } = await supabase
    .from('magnets')
    .delete()
    .eq('id', magnetId)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
