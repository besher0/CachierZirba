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

@Entity('inventory_destructions')
@Unique('UQ_client_inventory_destruction_id', ['clientDestructionId'])
@Index('IDX_inventory_destructions_store_product_destroyed', [
  'storeId',
  'productClientId',
  'destroyedAt',
])
export class InventoryDestruction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  clientDestructionId: string;

  @Column({ type: 'uuid' })
  storeId: string;

  @ManyToOne(() => Store, (store) => store.inventoryDestructions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column({ type: 'varchar', length: 100 })
  productClientId: string;

  @Column({ type: 'real' })
  quantity: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column()
  destroyedAt: Date;

  @Column()
  syncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
