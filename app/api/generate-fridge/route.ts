import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../utils/supabase/api-helpers'

const SF_API_URL = 'https://api.siliconflow.cn'
const SF_API_KEY = process.env.SILICONFLOW_API_KEY
const IMAGE_MODEL = 'black-forest-labs/FLUX.1-schnell'

const FRIDGE_STYLES: Record<string, string> = {
  'retro-american': '复古美式双开门冰箱，奶油白色烤漆，圆角设计，镀铬把手，正面视图，纯白背景',
  'nordic': '北欧极简单门冰箱，哑光灰绿色，木纹把手，嵌入式设计，正面视图，纯白背景',
  'japanese': '日式小型冰箱，粉白色，可爱圆润轮廓，银色把手，正面视图，纯白背景',
  'industrial': '工业风黑色不锈钢冰箱，磨砂质感，金属拉手，正面视图，纯白背景',
  'french': '法式复古冰箱，薄荷绿，弧形轮廓，黄铜把手，正面视图，纯白背景',
  'smart': '现代智能冰箱，深空灰，内嵌屏幕，极简把手，正面视图，纯白背景',
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request)
  if ('status' in user) return user as NextResponse

  const body = await request.json()
  const styleKey = (body.style || '').trim()
  const customStyle = (body.customStyle || '').trim()

  let styleDesc: string
  if (styleKey === 'custom' && customStyle) {
    styleDesc = customStyle
  } else {
    styleDesc = FRIDGE_STYLES[styleKey]
    if (!styleDesc) {
      const keys = Object.keys(FRIDGE_STYLES)
      styleDesc = FRIDGE_STYLES[keys[Math.floor(Math.random() * keys.length)]]
    }
  }

  const prompt = `A realistic ${styleDesc}, refrigerator as the main subject, pure white background, no people, no text, no brand logos, high detail, product photography style.`

  try {
    const res = await fetch(`${SF_API_URL}/v1/images/generations`, {
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

    if (!res.ok) {
      const errText = await res.text()
      console.error('SiliconFlow fridge generate error:', errText)
      return NextResponse.json({ error: '生成失败: ' + errText }, { status: 500 })
    }

    const data = await res.json()
    // SiliconFlow returns { images: [{ url: "..." }] }
    const imageUrl = data.images?.[0]?.url
    if (!imageUrl) {
      console.error('SiliconFlow no image in response:', JSON.stringify(data))
      return NextResponse.json({ error: 'AI未返回图片' }, { status: 500 })
    }

    // Fetch the image and convert to base64
    const imgRes = await fetch(imageUrl)
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer())
    const imageB64 = imgBuffer.toString('base64')

    return NextResponse.json({ image: imageB64, mimeType: 'image/png' })
  } catch (e: any) {
    console.error('generate-fridge error:', e)
    return NextResponse.json({ error: e.message || '生成失败' }, { status: 500 })
  }
}
