import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { DailySettlement } from '../../daily-settlements/entities/daily-settlement.entity';
import { Store } from '../../stores/entities/store.entity';

@Entity('inventory_settlement_snapshots')
@Unique('UQ_inventory_snapshot_settlement_product', [
  'settlementId',
  'productClientId',
])
@Index('IDX_inventory_snapshots_store_settlement', ['storeId', 'settlementId'])
export class InventorySettlementSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  settlementId: string;

  @ManyToOne(() => DailySettlement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'settlementId' })
  settlement: DailySettlement;

  @Column({ type: 'uuid' })
  storeId: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column({ type: 'varchar', length: 100 })
  productClientId: string;

  @Column({ type: 'real' })
  quantity: number;

  @CreateDateColumn()
  createdAt: Date;
}
