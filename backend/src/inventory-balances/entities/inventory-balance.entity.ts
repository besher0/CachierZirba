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

@Entity('inventory_balances')
@Unique('UQ_inventory_balances_store_product', ['storeId', 'productClientId'])
@Index('IDX_inventory_balances_store_product', ['storeId', 'productClientId'])
export class InventoryBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  storeId: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column({ type: 'varchar', length: 100 })
  productClientId: string;

  @Column({ type: 'real', default: 0 })
  quantity: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
