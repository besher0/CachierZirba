import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeWithdrawal } from '../employees/entities/employee-withdrawal.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Order } from '../orders/entities/order.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { StoresModule } from '../stores/stores.module';
import { DailySettlementsController } from './daily-settlements.controller';
import { DailySettlementsService } from './daily-settlements.service';
import { DailySettlement } from './entities/daily-settlement.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DailySettlement,
      Order,
      Expense,
      Purchase,
      EmployeeWithdrawal,
    ]),
    StoresModule,
  ],
  controllers: [DailySettlementsController],
  providers: [DailySettlementsService],
  exports: [DailySettlementsService, TypeOrmModule],
})
export class DailySettlementsModule {}
