import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../utils/supabase/api-helpers'
import sharp from 'sharp'

const SF_API_URL = 'https://api.siliconflow.cn'
const SF_API_KEY = process.env.SILICONFLOW_API_KEY
const VISION_MODEL = 'Qwen/Qwen2.5-VL-7B-Instruct'
const IMAGE_MODEL = 'black-forest-labs/FLUX.1-schnell'

const BADGE_PROMPT_SUFFIX = `travel souvenir fridge magnet badge icon, resin/enamel/metal/acrylic magnet texture, 3D thickness, micro embossed, outlined, highlighted, edge reflection, no shadow, no magnet handle, icon centered, small size, pure white background, wide margins, no text, no watermark`

export async function POST(request: NextRequest) {
  const user = await requireAuth(request)
  if ('status' in user) return user as NextResponse

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer())

  // Convert to base64 JPEG for vision API
  const jpegBuffer = await sharp(fileBuffer)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
  const photoB64 = jpegBuffer.toString('base64')

  try {
    // Step 1: Analyze image with vision model
    const analyzeRes = await fetch(`${SF_API_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Describe the most recognizable main subject in this photo in one short English phrase (max 10 words). Only output the subject description, nothing else.' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${photoB64}` } },
          ],
        }],
        max_tokens: 50,
      }),
      signal: AbortSignal.timeout(30000),
    })

    let subjectDesc = 'travel landmark'
    if (analyzeRes.ok) {
      const analyzeData = await analyzeRes.json()
      subjectDesc = analyzeData.choices?.[0]?.message?.content?.trim() || 'travel landmark'
    } else {
      console.warn('Vision analysis failed, using fallback')
    }

    // Step 2: Generate badge using text-to-image
    const prompt = `${subjectDesc}, ${BADGE_PROMPT_SUFFIX}`

    const genRes = await fetch(`${SF_API_URL}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt,
        image_size: '1024x1024',
        num_inference_steps: 4,
        batch_size: 1,
      }),
      signal: AbortSignal.timeout(120000),
    })

    if (!genRes.ok) {
      const errText = await genRes.text()
      console.error('SiliconFlow generate-badge error:', errText)
      return NextResponse.json({ error: 'AI生成失败: ' + errText }, { status: 500 })
    }

    const genData = await genRes.json()
    const imageUrl = genData.images?.[0]?.url
    if (!imageUrl) {
      console.error('SiliconFlow no image:', JSON.stringify(genData))
      return NextResponse.json({ error: 'AI未返回图片' }, { status: 500 })
    }

    // Fetch image
    const imgRes = await fetch(imageUrl)
    const imageBuffer = Buffer.from(await imgRes.arrayBuffer())

    // Step 3: Remove white background
    const processedBuffer = await removeWhiteBackground(imageBuffer)
    const resultB64 = processedBuffer.toString('base64')

    return NextResponse.json({ badge: resultB64, mimeType: 'image/png' })
  } catch (e: any) {
    console.error('generate-badge error:', e)
    return NextResponse.json({ error: e.message || '生成失败' }, { status: 500 })
  }
}

async function removeWhiteBackground(imgBuffer: Buffer): Promise<Buffer> {
  const img = sharp(imgBuffer)
  const metadata = await img.metadata()
  const w = metadata.width || 0
  const h = metadata.height || 0

  const rgba = await img.ensureAlpha().raw().toBuffer()
  const data = new Uint8ClampedArray(rgba)

  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 220 && data[i + 1] > 220 && data[i + 2] > 220) {
      data[i + 3] = 0
    }
  }

  return sharp(data, {
    raw: { width: w, height: h, channels: 4 },
  })
    .trim({ threshold: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}
