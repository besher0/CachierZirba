import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryBalancesModule } from '../inventory-balances/inventory-balances.module';
import { StoresModule } from '../stores/stores.module';
import { Purchase } from './entities/purchase.entity';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';

@Module({
  imports: [TypeOrmModule.forFeature([Purchase]), StoresModule, InventoryBalancesModule],
  controllers: [PurchasesController],
  providers: [PurchasesService],
  exports: [PurchasesService, TypeOrmModule],
})
export class PurchasesModule {}
