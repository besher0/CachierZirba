import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Store } from '../../stores/entities/store.entity';
import { ExpenseCategory } from '../enums/expense-category.enum';

@Entity('expenses')
@Unique('UQ_client_expense_id', ['clientExpenseId'])
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  clientExpenseId: string;

  @Column({ type: 'uuid' })
  storeId: string;

  @ManyToOne(() => Store, (store) => store.expenses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column({ type: 'varchar', length: 10 })
  expenseDate: string;

  @Column({ type: 'varchar', length: 40 })
  category: ExpenseCategory;

  @Column({ type: 'varchar', length: 300 })
  description: string;

  @Column({ type: 'real' })
  amount: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column()
  syncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
