import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailySettlement } from '../daily-settlements/entities/daily-settlement.entity';
import { Order } from '../orders/entities/order.entity';
import { Store } from '../stores/entities/store.entity';
import { StoresModule } from '../stores/stores.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([Store, Order, DailySettlement]), StoresModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}