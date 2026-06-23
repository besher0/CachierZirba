import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoresModule } from '../stores/stores.module';
import { InventoryDestruction } from './entities/inventory-destruction.entity';
import { InventoryDestructionsController } from './inventory-destructions.controller';
import { InventoryDestructionsService } from './inventory-destructions.service';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryDestruction]), StoresModule],
  controllers: [InventoryDestructionsController],
  providers: [InventoryDestructionsService],
  exports: [InventoryDestructionsService, TypeOrmModule],
})
export class InventoryDestructionsModule {}
