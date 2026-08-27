import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailySettlement } from '../daily-settlements/entities/daily-settlement.entity';
import { InventoryAdjustment } from '../inventory-adjustments/entities/inventory-adjustment.entity';
import { InventoryDestruction } from '../inventory-destructions/entities/inventory-destruction.entity';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { InventoryBalance } from './entities/inventory-balance.entity';
import { InventorySettlementSnapshot } from './entities/inventory-settlement-snapshot.entity';
import { InventoryBalancesService } from './inventory-balances.service';
import { InventoryReconciliationController } from './inventory-reconciliation.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryBalance,
      InventorySettlementSnapshot,
      Product,
      Purchase,
      Order,
      InventoryAdjustment,
      InventoryDestruction,
      DailySettlement,
    ]),
  ],
  controllers: [InventoryReconciliationController],
  providers: [InventoryBalancesService],
  exports: [InventoryBalancesService, TypeOrmModule],
})
export class InventoryBalancesModule {}
