-- Set lowStockAlert to 3 for ALL products regardless of current value
-- This ensures the threshold is consistent across the entire inventory
UPDATE "Product" SET "lowStockAlert" = 3;
