import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoresModule } from '../stores/stores.module';
import { Expense } from './entities/expense.entity';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [TypeOrmModule.forFeature([Expense]), StoresModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService, TypeOrmModule],
})
export class ExpensesModule {}
