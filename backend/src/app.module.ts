import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { DailySettlementsModule } from './daily-settlements/daily-settlements.module';
import { ExpensesModule } from './expenses/expenses.module';
import { OrdersModule } from './orders/orders.module';
import { PurchasesModule } from './purchases/purchases.module';
import { StoresModule } from './stores/stores.module';
import { createTypeOrmOptions } from './database/typeorm.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => createTypeOrmOptions(),
    }),
    AuthModule,
    StoresModule,
    OrdersModule,
    DailySettlementsModule,
    PurchasesModule,
    ExpensesModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
