import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { DailySettlement } from '../../daily-settlements/entities/daily-settlement.entity';
import { Expense } from '../../expenses/entities/expense.entity';
import { Order } from '../../orders/entities/order.entity';
import { Purchase } from '../../purchases/entities/purchase.entity';

@Entity('stores')
@Unique('UQ_store_code', ['code'])
export class Store {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => Order, (order) => order.store)
  orders: Order[];

  @OneToMany(() => DailySettlement, (settlement) => settlement.store)
  dailySettlements: DailySettlement[];

  @OneToMany(() => Expense, (expense) => expense.store)
  expenses: Expense[];

  @OneToMany(() => Purchase, (purchase) => purchase.store)
  purchases: Purchase[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
