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
import { OrderStatus } from '../enums/order-status.enum';
import { PaymentMethod } from '../enums/payment-method.enum';
import { OrderItem } from '../interfaces/order-item.interface';

@Entity('orders')
@Unique('UQ_client_order_id', ['clientOrderId'])
@Index('IDX_orders_store_ordered_at', ['storeId', 'orderedAt'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  clientOrderId: string;

  @Column({ type: 'uuid' })
  storeId: string;

  @ManyToOne(() => Store, (store) => store.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column({ type: 'varchar', length: 120, nullable: true })
  cashierName: string | null;

  @Column({ type: 'varchar', length: 20, default: OrderStatus.COMPLETED })
  status: OrderStatus;

  @Column({ type: 'varchar', length: 20, default: PaymentMethod.CASH })
  paymentMethod: PaymentMethod;

  @Column({ type: 'real' })
  subtotal: number;

  @Column({ type: 'real', default: 0 })
  discount: number;

  @Column({ type: 'real', default: 0 })
  tax: number;

  @Column({ type: 'real' })
  total: number;

  @Column({ type: 'simple-json' })
  items: OrderItem[];

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column()
  orderedAt: Date;

  @Column()
  syncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
