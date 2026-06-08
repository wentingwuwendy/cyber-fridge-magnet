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
  const fridgeId = parseInt(id)

  const supabase = await createAdminClient()

  // Get fridge info
  const { data: fridge, error: fetchError } = await supabase
    .from('fridges')
    .select('id, image_url')
    .eq('id', fridgeId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !fridge) {
    return NextResponse.json({ error: '冰箱不存在' }, { status: 404 })
  }

  // Delete associated magnets
  const { data: magnets } = await supabase
    .from('magnets')
    .select('id, image_url')
    .eq('fridge_id', fridgeId)
    .eq('user_id', user.id)

  if (magnets) {
    for (const magnet of magnets) {
      if (magnet.image_url) {
        try {
          // Extract path from URL: .../storage/v1/object/public/magnets/xxx
          const urlParts = magnet.image_url.split('/magnets/')
          if (urlParts.length > 1) {
            await deleteFromSupabaseStorage('magnets', urlParts[1])
          }
        } catch {
          // ignore storage delete errors
        }
      }
    }
    await supabase.from('magnets').delete().eq('fridge_id', fridgeId).eq('user_id', user.id)
  }

  // Delete fridge image
  if (fridge.image_url) {
    try {
      const urlParts = fridge.image_url.split('/fridges/')
      if (urlParts.length > 1) {
        await deleteFromSupabaseStorage('fridges', urlParts[1])
      }
    } catch {
      // ignore
    }
  }

  // Delete fridge
  const { error: deleteError } = await supabase
    .from('fridges')
    .delete()
    .eq('id', fridgeId)
    .eq('user_id', user.id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
