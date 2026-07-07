-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(64) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `role` ENUM('ADMIN', 'CASHIER') NOT NULL DEFAULT 'CASHIER',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_audits` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_audits_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `categories_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `categoryId` INTEGER NULL,
    `isScaleItem` BOOLEAN NOT NULL DEFAULT false,
    `lowStockThreshold` DECIMAL(16, 3) NOT NULL DEFAULT 0,
    `expiryDate` DATE NULL,
    `discountPercent` DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `secondPrice` DECIMAL(16, 2) NULL,
    `isComposite` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `products_code_key`(`code`),
    INDEX `products_name_idx`(`name`),
    INDEX `products_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_batches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `qtyInitial` DECIMAL(16, 3) NOT NULL,
    `qtyRemaining` DECIMAL(16, 3) NOT NULL,
    `buyPrice` DECIMAL(16, 2) NOT NULL,
    `sellPrice` DECIMAL(16, 2) NOT NULL,
    `sellPriceUSD` DECIMAL(16, 2) NULL,
    `currency` ENUM('TMT', 'USD') NOT NULL DEFAULT 'TMT',
    `buyRate` DECIMAL(16, 2) NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `invoiceNo` INTEGER NULL,
    `supplierDebtCode` VARCHAR(64) NULL,
    `legacyAmmarId` VARCHAR(64) NULL,

    INDEX `stock_batches_productId_receivedAt_idx`(`productId`, `receivedAt`),
    INDEX `stock_batches_qtyRemaining_idx`(`qtyRemaining`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `unit_packs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `qtyInside` DECIMAL(16, 3) NOT NULL,
    `buyPrice` DECIMAL(16, 2) NOT NULL,
    `sellPrice` DECIMAL(16, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `unit_packs_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recipes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `compositeProductId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `recipes_compositeProductId_key`(`compositeProductId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recipe_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `recipeId` INTEGER NOT NULL,
    `ingredientProductId` INTEGER NOT NULL,
    `qty` DECIMAL(16, 3) NOT NULL,

    INDEX `recipe_items_recipeId_idx`(`recipeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `receiptNo` INTEGER NOT NULL,
    `datetime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `cashierId` INTEGER NOT NULL,
    `total` DECIMAL(16, 2) NOT NULL,
    `paidCash` DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `paidCard` DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `paidDebt` DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `changeGiven` DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `discount` DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `debtorId` INTEGER NULL,
    `exchangeRate` DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `cogsTotal` DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `shopId` ENUM('MAIN', 'SECOND') NOT NULL DEFAULT 'MAIN',
    `legacySowdaId` VARCHAR(64) NULL,

    INDEX `sales_receiptNo_idx`(`receiptNo`),
    INDEX `sales_datetime_idx`(`datetime`),
    INDEX `sales_debtorId_idx`(`debtorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sale_lines` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `saleId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `batchBreakdown` JSON NOT NULL,
    `qty` DECIMAL(16, 3) NOT NULL,
    `unitPackId` INTEGER NULL,
    `unitPrice` DECIMAL(16, 2) NOT NULL,
    `lineTotal` DECIMAL(16, 2) NOT NULL,
    `cogs` DECIMAL(16, 2) NOT NULL,
    `categoryNameSnapshot` VARCHAR(191) NULL,
    `productNameSnapshot` VARCHAR(191) NOT NULL,

    INDEX `sale_lines_saleId_idx`(`saleId`),
    INDEX `sale_lines_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `returns` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `saleLineId` INTEGER NOT NULL,
    `qty` DECIMAL(16, 3) NOT NULL,
    `datetime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `restockedBatchId` INTEGER NOT NULL,
    `moneyAdjustment` DECIMAL(16, 2) NOT NULL,

    INDEX `returns_saleLineId_idx`(`saleLineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `phone` VARCHAR(32) NULL,
    `accountCurrency` ENUM('TMT', 'USD') NOT NULL DEFAULT 'TMT',
    `balance` DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `customers_code_key`(`code`),
    INDEX `customers_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `debt_sales` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `debtorId` INTEGER NOT NULL,
    `saleId` INTEGER NOT NULL,
    `invoiceNo` INTEGER NULL,
    `saleDate` DATETIME(3) NOT NULL,
    `dueDate` DATETIME(3) NULL,
    `amount` DECIMAL(16, 2) NOT NULL,
    `paid` DECIMAL(16, 2) NOT NULL DEFAULT 0,

    UNIQUE INDEX `debt_sales_saleId_key`(`saleId`),
    INDEX `debt_sales_debtorId_idx`(`debtorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `debt_schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `debtorId` INTEGER NOT NULL,
    `invoiceNo` INTEGER NULL,
    `txDate` DATETIME(3) NOT NULL,
    `dueDate` DATETIME(3) NULL,
    `openingBalance` DECIMAL(16, 2) NOT NULL,
    `amount` DECIMAL(16, 2) NOT NULL,
    `paid` DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `closingBalance` DECIMAL(16, 2) NOT NULL,

    INDEX `debt_schedules_debtorId_dueDate_idx`(`debtorId`, `dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `debt_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `debtorId` INTEGER NOT NULL,
    `amount` DECIMAL(16, 2) NOT NULL,
    `currency` ENUM('TMT', 'USD') NOT NULL DEFAULT 'TMT',
    `datetime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `note` TEXT NULL,
    `receiptPrinted` BOOLEAN NOT NULL DEFAULT false,

    INDEX `debt_payments_debtorId_idx`(`debtorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `suppliers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `phone` VARCHAR(32) NULL,
    `balance` DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `suppliers_code_key`(`code`),
    INDEX `suppliers_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_debt_moves` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `supplierId` INTEGER NOT NULL,
    `invoiceNo` INTEGER NULL,
    `txDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `type` ENUM('PURCHASE', 'PAYMENT') NOT NULL,
    `amount` DECIMAL(16, 2) NOT NULL,
    `opening` DECIMAL(16, 2) NOT NULL,
    `closing` DECIMAL(16, 2) NOT NULL,
    `note` TEXT NULL,

    INDEX `supplier_debt_moves_supplierId_idx`(`supplierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cash_register_days` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `openingBalance` DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `income` DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `expense` DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `closingBalance` DECIMAL(16, 2) NOT NULL DEFAULT 0,

    UNIQUE INDEX `cash_register_days_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cash_moves` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `datetime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `type` ENUM('SALE_CASH', 'DEPOSIT', 'WITHDRAWAL', 'PURCHASE_PAYMENT', 'DEBT_PAYMENT_IN') NOT NULL,
    `amount` DECIMAL(16, 2) NOT NULL,
    `balanceBefore` DECIMAL(16, 2) NOT NULL,
    `note` VARCHAR(191) NULL,

    INDEX `cash_moves_datetime_idx`(`datetime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_discounts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `method` ENUM('CASH', 'CARD', 'DEBT') NOT NULL,
    `percent` DECIMAL(16, 2) NOT NULL DEFAULT 0,

    UNIQUE INDEX `payment_discounts_method_key`(`method`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exchange_rates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rate` DECIMAL(16, 2) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `exchange_rates_effectiveFrom_idx`(`effectiveFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `needed_products` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(64) NULL,
    `qty` DECIMAL(16, 3) NOT NULL DEFAULT 0,
    `categoryId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_revisions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `note` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `revision_lines` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `revisionId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `systemQty` DECIMAL(16, 3) NOT NULL,
    `countedQty` DECIMAL(16, 3) NOT NULL,
    `diff` DECIMAL(16, 3) NOT NULL,
    `unitPrice` DECIMAL(16, 2) NOT NULL,
    `amount` DECIMAL(16, 2) NOT NULL,
    `sellPriceRef` DECIMAL(16, 2) NULL,
    `result` VARCHAR(64) NULL,
    `note` TEXT NULL,

    INDEX `revision_lines_revisionId_idx`(`revisionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stocktakes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `status` ENUM('OPEN', 'FINISHED') NOT NULL DEFAULT 'OPEN',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stocktake_lines` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stocktakeId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `countedQty` DECIMAL(16, 3) NOT NULL,
    `systemQty` DECIMAL(16, 3) NOT NULL,
    `diff` DECIMAL(16, 3) NOT NULL,

    INDEX `stocktake_lines_stocktakeId_idx`(`stocktakeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_summaries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `cogs` DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `revenue` DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `profit` DECIMAL(16, 2) NOT NULL DEFAULT 0,

    UNIQUE INDEX `daily_summaries_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `license` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `remainingDays` INTEGER NOT NULL DEFAULT 0,
    `lastSeenDate` DATE NOT NULL,
    `hardwareId` VARCHAR(191) NULL,
    `plan` ENUM('TRIAL', 'STANDARD', 'UNLIMITED') NOT NULL DEFAULT 'TRIAL',
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activation_codes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(64) NOT NULL,
    `days` INTEGER NOT NULL DEFAULT 0,
    `usedAt` DATETIME(3) NULL,

    UNIQUE INDEX `activation_codes_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `key` VARCHAR(64) NOT NULL,
    `value` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `code_sequences` (
    `pool` VARCHAR(32) NOT NULL,
    `next` INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY (`pool`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `login_audits` ADD CONSTRAINT `login_audits_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_batches` ADD CONSTRAINT `stock_batches_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `unit_packs` ADD CONSTRAINT `unit_packs_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recipes` ADD CONSTRAINT `recipes_compositeProductId_fkey` FOREIGN KEY (`compositeProductId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recipe_items` ADD CONSTRAINT `recipe_items_recipeId_fkey` FOREIGN KEY (`recipeId`) REFERENCES `recipes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recipe_items` ADD CONSTRAINT `recipe_items_ingredientProductId_fkey` FOREIGN KEY (`ingredientProductId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_cashierId_fkey` FOREIGN KEY (`cashierId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_debtorId_fkey` FOREIGN KEY (`debtorId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_lines` ADD CONSTRAINT `sale_lines_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_lines` ADD CONSTRAINT `sale_lines_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_lines` ADD CONSTRAINT `sale_lines_unitPackId_fkey` FOREIGN KEY (`unitPackId`) REFERENCES `unit_packs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `returns` ADD CONSTRAINT `returns_saleLineId_fkey` FOREIGN KEY (`saleLineId`) REFERENCES `sale_lines`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `returns` ADD CONSTRAINT `returns_restockedBatchId_fkey` FOREIGN KEY (`restockedBatchId`) REFERENCES `stock_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `debt_sales` ADD CONSTRAINT `debt_sales_debtorId_fkey` FOREIGN KEY (`debtorId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `debt_sales` ADD CONSTRAINT `debt_sales_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `debt_schedules` ADD CONSTRAINT `debt_schedules_debtorId_fkey` FOREIGN KEY (`debtorId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `debt_payments` ADD CONSTRAINT `debt_payments_debtorId_fkey` FOREIGN KEY (`debtorId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_debt_moves` ADD CONSTRAINT `supplier_debt_moves_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `needed_products` ADD CONSTRAINT `needed_products_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `revision_lines` ADD CONSTRAINT `revision_lines_revisionId_fkey` FOREIGN KEY (`revisionId`) REFERENCES `stock_revisions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `revision_lines` ADD CONSTRAINT `revision_lines_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stocktake_lines` ADD CONSTRAINT `stocktake_lines_stocktakeId_fkey` FOREIGN KEY (`stocktakeId`) REFERENCES `stocktakes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stocktake_lines` ADD CONSTRAINT `stocktake_lines_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
