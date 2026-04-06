-- Pulp Pricing Intelligence - Initial Schema
-- Migration 001

CREATE TABLE IF NOT EXISTS markets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  region VARCHAR(100) NOT NULL,
  benchmark_flag BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grades (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  market_id INT REFERENCES markets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
  grade_id INT REFERENCES grades(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  volume NUMERIC(12, 2) NOT NULL,
  list_price NUMERIC(10, 2) NOT NULL,
  net_price NUMERIC(10, 2) NOT NULL,
  rebates NUMERIC(10, 2) DEFAULT 0,
  discounts NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contracts (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
  yearly_volume NUMERIC(14, 2) NOT NULL,
  pricing_type VARCHAR(20) NOT NULL CHECK (pricing_type IN ('indexed', 'negotiated')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competitor_prices (
  id SERIAL PRIMARY KEY,
  market_id INT REFERENCES markets(id) ON DELETE CASCADE,
  grade_id INT REFERENCES grades(id) ON DELETE SET NULL,
  price NUMERIC(10, 2) NOT NULL,
  date DATE NOT NULL,
  source VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS market_news (
  id SERIAL PRIMARY KEY,
  market_id INT REFERENCES markets(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  summary TEXT,
  sentiment VARCHAR(20) NOT NULL CHECK (sentiment IN ('bullish', 'neutral', 'bearish')),
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expert_insights (
  id SERIAL PRIMARY KEY,
  source VARCHAR(100) NOT NULL,
  market_id INT REFERENCES markets(id) ON DELETE CASCADE,
  grade_id INT REFERENCES grades(id) ON DELETE SET NULL,
  price_forecast_low NUMERIC(10, 2) NOT NULL,
  price_forecast_high NUMERIC(10, 2) NOT NULL,
  sentiment VARCHAR(20) NOT NULL CHECK (sentiment IN ('bullish', 'neutral', 'bearish')),
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL CHECK (type IN ('outage', 'price_increase', 'capacity')),
  company VARCHAR(200),
  description TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manual_inputs (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL CHECK (type IN ('notes', 'meeting_insights')),
  content TEXT NOT NULL,
  market_id INT REFERENCES markets(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_notes (
  id SERIAL PRIMARY KEY,
  market_id INT REFERENCES markets(id) ON DELETE SET NULL,
  customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('customer_meeting', 'internal_meeting', 'agent_call')),
  raw_text TEXT NOT NULL,
  extracted_sentiment VARCHAR(20) NOT NULL CHECK (extracted_sentiment IN ('bullish', 'neutral', 'bearish')),
  extracted_signals JSONB DEFAULT '[]',
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_grade_id ON orders(grade_id);
CREATE INDEX IF NOT EXISTS idx_competitor_prices_date ON competitor_prices(date);
CREATE INDEX IF NOT EXISTS idx_competitor_prices_market_id ON competitor_prices(market_id);
CREATE INDEX IF NOT EXISTS idx_competitor_prices_grade_id ON competitor_prices(grade_id);
CREATE INDEX IF NOT EXISTS idx_market_news_date ON market_news(date);
CREATE INDEX IF NOT EXISTS idx_market_news_market_id ON market_news(market_id);
CREATE INDEX IF NOT EXISTS idx_expert_insights_date ON expert_insights(date);
CREATE INDEX IF NOT EXISTS idx_expert_insights_market_id ON expert_insights(market_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_date ON meeting_notes(date);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_market_id ON meeting_notes(market_id);
CREATE INDEX IF NOT EXISTS idx_customers_market_id ON customers(market_id);
CREATE INDEX IF NOT EXISTS idx_contracts_customer_id ON contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_manual_inputs_date ON manual_inputs(date);

-- Seed data: Markets
INSERT INTO markets (name, region, benchmark_flag) VALUES
  ('China', 'Asia', true),
  ('Europe', 'Europe', false),
  ('North America', 'Americas', false),
  ('LATAM', 'Americas', false),
  ('Asia Pacific', 'Asia Pacific', false)
ON CONFLICT DO NOTHING;

-- Seed data: Grades
INSERT INTO grades (name) VALUES
  ('EKP'),
  ('BKP'),
  ('UKP Paper'),
  ('UKP Fiber Cement')
ON CONFLICT DO NOTHING;
