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

@Entity('daily_settlements')
@Unique('UQ_client_closure_id', ['clientClosureId'])
@Unique('UQ_store_business_date', ['storeId', 'businessDate'])
export class DailySettlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  clientClosureId: string;

  @Column({ type: 'uuid' })
  storeId: string;

  @ManyToOne(() => Store, (store) => store.dailySettlements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column({ type: 'varchar', length: 10 })
  businessDate: string;

  @Column({ type: 'real' })
  cashBoxAmount: number;

  @Column({ type: 'real' })
  sharesAmount: number;

  @Column({ type: 'real', default: 0 })
  actualRemainingAmount: number;

  @Column({ type: 'real', default: 0 })
  expectedRevenue: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column()
  syncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
