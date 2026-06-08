-- 冰箱表
CREATE TABLE IF NOT EXISTS fridges (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '我的冰箱',
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 冰箱贴表
CREATE TABLE IF NOT EXISTS magnets (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fridge_id BIGINT REFERENCES fridges(id) ON DELETE CASCADE,
  location TEXT NOT NULL DEFAULT '',
  note TEXT DEFAULT '',
  lat FLOAT,
  lng FLOAT,
  pos_x FLOAT NOT NULL DEFAULT 0.4,
  pos_y FLOAT NOT NULL DEFAULT 0.3,
  scale FLOAT NOT NULL DEFAULT 1.0,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_fridges_user ON fridges(user_id);
CREATE INDEX IF NOT EXISTS idx_magnets_user ON magnets(user_id);
CREATE INDEX IF NOT EXISTS idx_magnets_fridge ON magnets(fridge_id);

-- RLS 策略
ALTER TABLE fridges ENABLE ROW LEVEL SECURITY;
ALTER TABLE magnets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can manage own fridges" ON fridges;
CREATE POLICY "users can manage own fridges" ON fridges
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can manage own magnets" ON magnets;
CREATE POLICY "users can manage own magnets" ON magnets
  FOR ALL USING (auth.uid() = user_id);
