import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoresModule } from '../stores/stores.module';
import { DailySettlementsController } from './daily-settlements.controller';
import { DailySettlementsService } from './daily-settlements.service';
import { DailySettlement } from './entities/daily-settlement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DailySettlement]), StoresModule],
  controllers: [DailySettlementsController],
  providers: [DailySettlementsService],
  exports: [DailySettlementsService, TypeOrmModule],
})
export class DailySettlementsModule {}