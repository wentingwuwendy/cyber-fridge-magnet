import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../utils/supabase/api-helpers'

const COOPER_API_URL = 'https://cooper-api.com'
const COOPER_API_KEY = process.env.COOPER_API_KEY
const MODEL = 'gpt-image-2'

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
      // Random fallback
      const keys = Object.keys(FRIDGE_STYLES)
      styleDesc = FRIDGE_STYLES[keys[Math.floor(Math.random() * keys.length)]]
    }
  }

  const prompt = `生成一张写实风格的${styleDesc}。冰箱占画面主体，背景纯白，无人物，无文字，无品牌标志，高清细节，产品摄影风格。`

  try {
    const res = await fetch(`${COOPER_API_URL}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COOPER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
      }),
      signal: AbortSignal.timeout(120000),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Cooper API fridge generate error:', errText)
      return NextResponse.json({ error: '生成失败' }, { status: 500 })
    }

    const data = await res.json()
    const imageB64 = data.data?.[0]?.b64_json
    if (!imageB64) {
      return NextResponse.json({ error: 'AI未返回图片' }, { status: 500 })
    }

    return NextResponse.json({ image: imageB64, mimeType: 'image/png' })
  } catch (e: any) {
    console.error('generate-fridge error:', e)
    return NextResponse.json({ error: e.message || '生成失败' }, { status: 500 })
  }
}
