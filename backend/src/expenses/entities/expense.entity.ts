import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Store } from '../../stores/entities/store.entity';

@Entity('expenses')
@Unique('UQ_client_expense_id', ['clientExpenseId'])
@Index('IDX_expenses_store_expense_date', ['storeId', 'expenseDate'])
@Index('IDX_expenses_store_cycle_start', ['storeId', 'cycleStartClosureId'])
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

  @Column({ type: 'varchar', length: 100, nullable: true })
  cycleStartClosureId: string | null;

  @Column({ type: 'varchar', length: 80 })
  category: string;

  @Column({ type: 'varchar', length: 300 })
  description: string;

  @Column({ type: 'real' })
  amount: number;

  @Column({ type: 'text', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column()
  syncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
