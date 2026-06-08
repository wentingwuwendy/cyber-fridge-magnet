import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../utils/supabase/api-helpers'
import { createAdminClient } from '../../../../../utils/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request)
  if ('status' in user) return user as NextResponse

  const { id } = await params
  const magnetId = parseInt(id)
  const body = await request.json()

  const posX = Math.max(0, Math.min(1, body.posX ?? 0.4))
  const posY = Math.max(0, Math.min(1, body.posY ?? 0.3))
  const scale = Math.max(0.3, Math.min(3.0, body.scale ?? 1.0))

  const supabase = await createAdminClient()
  const { error } = await supabase
    .from('magnets')
    .update({ pos_x: posX, pos_y: posY, scale })
    .eq('id', magnetId)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
