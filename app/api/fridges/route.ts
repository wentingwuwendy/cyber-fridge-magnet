import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../utils/supabase/api-helpers'
import { createAdminClient } from '../../../utils/supabase/server'

export async function GET(request: NextRequest) {
  const user = await requireAuth(request)
  if ('status' in user) return user as NextResponse

  const supabase = await createAdminClient()
  const { data: fridges, error } = await supabase
    .from('fridges')
    .select('id, name, image_url, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Auto-create default fridge if none exist
  if (!fridges || fridges.length === 0) {
    const { data: newFridge, error: createError } = await supabase
      .from('fridges')
      .insert({ user_id: user.id, name: '我的冰箱' })
      .select()
      .single()

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    return NextResponse.json({ fridges: [newFridge] })
  }

  return NextResponse.json({ fridges })
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request)
  if ('status' in user) return user as NextResponse

  const body = await request.json()
  const name = ((body.name || '新冰箱') as string).trim().slice(0, 30)
  const imageUrl = body.image_url as string | undefined

  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('fridges')
    .insert({ user_id: user.id, name, image_url: imageUrl })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
