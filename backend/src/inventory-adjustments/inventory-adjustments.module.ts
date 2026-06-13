import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoresModule } from '../stores/stores.module';
import { InventoryAdjustment } from './entities/inventory-adjustment.entity';
import { InventoryAdjustmentsController } from './inventory-adjustments.controller';
import { InventoryAdjustmentsService } from './inventory-adjustments.service';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryAdjustment]), StoresModule],
  controllers: [InventoryAdjustmentsController],
  providers: [InventoryAdjustmentsService],
  exports: [InventoryAdjustmentsService, TypeOrmModule],
})
export class InventoryAdjustmentsModule {}
