-- Change default lowStockAlert from 5 to 3 for new products
ALTER TABLE "Product" ALTER COLUMN "lowStockAlert" SET DEFAULT 3;

-- Update existing products that still have the old default value of 5
UPDATE "Product" SET "lowStockAlert" = 3 WHERE "lowStockAlert" = 5;
