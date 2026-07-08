import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { LicenseModule } from './license/license.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { RolesGuard } from './auth/roles.guard.js';
import { HealthController } from './health.controller.js';
import { CodesModule } from './codes/codes.module.js';
import { CashModule } from './cash/cash.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { ReceivingModule } from './receiving/receiving.module.js';
import { StockViewsModule } from './stock-views/stock-views.module.js';
import { LabelsModule } from './labels/labels.module.js';
import { PluModule } from './plu/plu.module.js';
import { SuppliersModule } from './suppliers/suppliers.module.js';
import { FifoModule } from './fifo/fifo.module.js';
import { SalesModule } from './sales/sales.module.js';
import { PrintingModule } from './printing/printing.module.js';
import { SmsModule } from './sms/sms.module.js';
import { DebtorsModule } from './debtors/debtors.module.js';
import { ReturnsModule } from './returns/returns.module.js';
import { RevisionModule } from './revision/revision.module.js';
import { SecondShopModule } from './second-shop/second-shop.module.js';
import { RecipesModule } from './recipes/recipes.module.js';
import { NeededProductsModule } from './needed-products/needed-products.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    UsersModule,
    AuthModule,
    LicenseModule,
    SettingsModule,
    RealtimeModule,
    CodesModule,
    CashModule,
    CatalogModule,
    ReceivingModule,
    StockViewsModule,
    LabelsModule,
    PluModule,
    SuppliersModule,
    FifoModule,
    SalesModule,
    PrintingModule,
    SmsModule,
    DebtorsModule,
    ReturnsModule,
    RevisionModule,
    SecondShopModule,
    RecipesModule,
    NeededProductsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global guards: JWT everywhere (except @Public), then role checks.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
