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

@Entity('inventory_adjustments')
@Unique('UQ_client_inventory_adjustment_id', ['clientAdjustmentId'])
@Index('IDX_inventory_adjustments_store_product_adjusted', [
  'storeId',
  'productClientId',
  'adjustedAt',
])
export class InventoryAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  clientAdjustmentId: string;

  @Column({ type: 'uuid' })
  storeId: string;

  @ManyToOne(() => Store, (store) => store.inventoryAdjustments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column({ type: 'varchar', length: 100 })
  productClientId: string;

  @Column({ type: 'real' })
  actualQuantity: number;

  @Column()
  adjustedAt: Date;

  @Column()
  syncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
