import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryBalancesModule } from '../inventory-balances/inventory-balances.module';
import { Product } from '../products/entities/product.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { StoresModule } from '../stores/stores.module';
import { InventoryStockController } from './inventory-stock.controller';
import { InventoryStockService } from './inventory-stock.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Purchase]),
    InventoryBalancesModule,
    StoresModule,
  ],
  controllers: [InventoryStockController],
  providers: [InventoryStockService],
})
export class InventoryStockModule {}
