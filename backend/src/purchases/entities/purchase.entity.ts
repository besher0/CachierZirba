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

@Entity('purchases')
@Unique('UQ_client_purchase_id', ['clientPurchaseId'])
@Index('IDX_purchases_store_date_created', ['storeId', 'purchaseDate', 'createdAt'])
export class Purchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  clientPurchaseId: string;

  @Column({ type: 'uuid' })
  storeId: string;

  @ManyToOne(() => Store, (store) => store.purchases, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column({ type: 'varchar', length: 120 })
  productName: string;

  @Column({ type: 'real' })
  quantity: number;

  @Column({ type: 'real' })
  unitCost: number;

  @Column({ type: 'real' })
  totalCost: number;

  @Column({ type: 'varchar', length: 20, default: 'SUPPLY' })
  purchaseKind: 'SUPPLY' | 'TAWASI' | 'PAYMENT';

  @Column({ type: 'real', nullable: true })
  sellPrice: number | null;

  @Column({ type: 'real', default: 0 })
  paymentAmount: number;

  @Column({ type: 'varchar', length: 10 })
  purchaseDate: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column()
  syncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
