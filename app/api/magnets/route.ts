import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, uploadToSupabaseStorage } from '../../../utils/supabase/api-helpers'
import { createAdminClient } from '../../../utils/supabase/server'
import sharp from 'sharp'

export async function GET(request: NextRequest) {
  const user = await requireAuth(request)
  if ('status' in user) return user as NextResponse

  const fridgeId = request.nextUrl.searchParams.get('fridge_id')
  if (!fridgeId) {
    return NextResponse.json({ error: 'fridge_id required' }, { status: 400 })
  }

  const supabase = await createAdminClient()
  const { data: magnets, error } = await supabase
    .from('magnets')
    .select('id, location, note, lat, lng, pos_x, pos_y, scale, image_url, created_at')
    .eq('user_id', user.id)
    .eq('fridge_id', parseInt(fridgeId))
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ magnets })
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request)
  if ('status' in user) return user as NextResponse

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const location = (formData.get('location') as string) || '旅行地'
  const note = (formData.get('note') as string) || ''
  const lat = parseFloat(formData.get('lat') as string || '0')
  const lng = parseFloat(formData.get('lng') as string || '0')
  const fridgeId = parseInt(formData.get('fridge_id') as string || '1')

  if (!file) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }

  // Read file as buffer
  const fileBuffer = Buffer.from(await file.arrayBuffer())

  // Remove white background and trim using sharp
  let processedBuffer: Buffer
  try {
    const image = sharp(fileBuffer)
    const metadata = await image.metadata()

    if (metadata.format) {
      // Convert to RGBA
      const rgba = sharp(fileBuffer).ensureAlpha()
      const rgbaBuffer = await rgba.toBuffer()
      const img = sharp(rgbaBuffer)
      const info = await img.metadata()
      const w = info.width || 0
      const h = info.height || 0

      // Remove near-white pixels (RGB > 220)
      const raw = await img.raw().toBuffer()
      const rgbaData = new Uint8ClampedArray(raw)
      for (let i = 0; i < rgbaData.length; i += 4) {
        if (rgbaData[i] > 220 && rgbaData[i + 1] > 220 && rgbaData[i + 2] > 220) {
          rgbaData[i + 3] = 0 // set alpha to 0
        }
      }

      processedBuffer = await sharp(rgbaData, {
        raw: { width: w, height: h, channels: 4 },
      })
        .trim({ threshold: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    } else {
      processedBuffer = fileBuffer
    }
  } catch {
    processedBuffer = fileBuffer
  }

  // Upload to Supabase Storage
  const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`
  let imageUrl: string
  try {
    imageUrl = await uploadToSupabaseStorage('magnets', fileName, processedBuffer, 'image/png')
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Upload failed' }, { status: 500 })
  }

  // Save to database
  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('magnets')
    .insert({
      user_id: user.id,
      fridge_id: fridgeId,
      location: location.trim(),
      note: note.trim(),
      lat: lat || null,
      lng: lng || null,
      pos_x: 0.4,
      pos_y: 0.3,
      scale: 1.0,
      image_url: imageUrl,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
