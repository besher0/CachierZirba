import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryAdjustment } from '../inventory-adjustments/entities/inventory-adjustment.entity';
import { InventoryDestruction } from '../inventory-destructions/entities/inventory-destruction.entity';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { StoresModule } from '../stores/stores.module';
import { InventoryStockController } from './inventory-stock.controller';
import { InventoryStockService } from './inventory-stock.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Purchase,
      Order,
      InventoryAdjustment,
      InventoryDestruction,
    ]),
    StoresModule,
  ],
  controllers: [InventoryStockController],
  providers: [InventoryStockService],
})
export class InventoryStockModule {}
