import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../utils/supabase/api-helpers'
import sharp from 'sharp'

const COOPER_API_URL = 'https://cooper-api.com'
const COOPER_API_KEY = process.env.COOPER_API_KEY
const VISION_MODEL = 'nano-banana-2'
const IMAGE_MODEL = 'imagen-3.0-generate-002'

const BADGE_SYSTEM_PROMPT = `从图片中提取最有识别度的主体元素，做成一个小巧精致的旅行纪念冰箱贴图标。保留核心轮廓并适度简化，有明显的树脂/搪瓷/金属/亚克力磁贴质感，带立体厚度、微浮雕、描边、高光、边缘反光，不要添加阴影或磁铁手柄。图标居中偏上、不要太大、纯白背景、周围留白，不要文字。`

export async function POST(request: NextRequest) {
  const user = await requireAuth(request)
  if ('status' in user) return user as NextResponse

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer())

  // Convert to base64 JPEG for API
  const jpegBuffer = await sharp(fileBuffer)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
  const photoB64 = jpegBuffer.toString('base64')

  try {
    // Step 1: Analyze image to extract main subject description
    const analyzeRes = await fetch(`${COOPER_API_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COOPER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: '请用一句话描述这张图片中最有识别度的主体元素是什么，不超过30个字。' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${photoB64}` } },
          ],
        }],
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!analyzeRes.ok) {
      const errText = await analyzeRes.text()
      console.error('Cooper API analyze error:', errText)
      return NextResponse.json({ error: 'AI分析失败' }, { status: 500 })
    }

    const analyzeData = await analyzeRes.json()
    const subjectDesc = analyzeData.choices?.[0]?.message?.content || ''

    // Step 2: Generate badge using text-to-image
    const prompt = `${BADGE_SYSTEM_PROMPT} 主体元素：${subjectDesc}`

    const genRes = await fetch(`${COOPER_API_URL}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COOPER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
      }),
      signal: AbortSignal.timeout(120000),
    })

    if (!genRes.ok) {
      const errText = await genRes.text()
      console.error('Cooper API generate error:', errText)
      return NextResponse.json({ error: 'AI生成失败' }, { status: 500 })
    }

    const genData = await genRes.json()
    const imageB64 = genData.data?.[0]?.b64_json
    if (!imageB64) {
      return NextResponse.json({ error: 'AI未返回图片' }, { status: 500 })
    }

    // Step 3: Process - remove white background
    const imageBuffer = Buffer.from(imageB64, 'base64')
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

  // Ensure alpha channel
  const rgba = await img.ensureAlpha().raw().toBuffer()
  const data = new Uint8ClampedArray(rgba)

  // Set near-white pixels to transparent
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 220 && data[i + 1] > 220 && data[i + 2] > 220) {
      data[i + 3] = 0
    }
  }

  // Trim transparent edges
  return sharp(data, {
    raw: { width: w, height: h, channels: 4 },
  })
    .trim({ threshold: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}
