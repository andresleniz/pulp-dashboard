-- Migration 002: Add year and month columns to orders
-- These replace date-based windowing with integer arithmetic that is
-- immune to day-of-month drift and maps directly to allocation periods.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS year  SMALLINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS month SMALLINT;

-- Back-fill from existing date column
UPDATE orders
SET year  = EXTRACT(YEAR  FROM date)::SMALLINT,
    month = EXTRACT(MONTH FROM date)::SMALLINT
WHERE year IS NULL;

-- Enforce NOT NULL once backfilled
ALTER TABLE orders ALTER COLUMN year  SET NOT NULL;
ALTER TABLE orders ALTER COLUMN month SET NOT NULL;

-- Index for year+month range queries
CREATE INDEX IF NOT EXISTS idx_orders_year_month ON orders(year, month);
