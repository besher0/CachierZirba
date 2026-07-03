import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Store } from '../../stores/entities/store.entity';

@Entity('cashbox_withdrawals')
@Index('IDX_cashbox_withdrawals_store_withdrawn', ['storeId', 'withdrawnAt'])
export class CashboxWithdrawal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  storeId: string | null;

  @ManyToOne(() => Store, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'storeId' })
  store: Store | null;

  @Column({ type: 'real' })
  amount: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column()
  withdrawnAt: Date;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  createdByDisplayName: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
