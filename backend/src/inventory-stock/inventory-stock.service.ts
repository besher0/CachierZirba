import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { InventoryAdjustment } from '../inventory-adjustments/entities/inventory-adjustment.entity';
import { InventoryDestruction } from '../inventory-destructions/entities/inventory-destruction.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { Product } from '../products/entities/product.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { StoresService } from '../stores/stores.service';
import { ListInventoryStockQueryDto } from './dto/list-inventory-stock-query.dto';
import { InventoryStockRow } from './interfaces/inventory-stock-row.interface';

@Injectable()
export class InventoryStockService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(InventoryAdjustment)
    private readonly adjustmentRepository: Repository<InventoryAdjustment>,
    @InjectRepository(InventoryDestruction)
    private readonly destructionRepository: Repository<InventoryDestruction>,
    private readonly storesService: StoresService,
  ) {}

  async findAll(
    query: ListInventoryStockQueryDto,
    authUser: AuthUser,
  ): Promise<InventoryStockRow[]> {
    const storeId = this.resolveStoreForRead(query.storeId, authUser);
    if (!storeId) {
      return [];
    }

    await this.storesService.findById(storeId);

    const [products, purchases, orders, adjustments, destructions] =
      await Promise.all([
        this.productRepository.find({ order: { name: 'ASC', createdAt: 'ASC' } }),
        this.purchaseRepository.find({
          where: { storeId },
          order: { purchaseDate: 'DESC', createdAt: 'DESC' },
        }),
        this.orderRepository.find({
          where: { storeId },
          order: { orderedAt: 'DESC', createdAt: 'DESC' },
        }),
        this.adjustmentRepository.find({
          where: { storeId },
          order: { adjustedAt: 'DESC', createdAt: 'DESC' },
        }),
        this.destructionRepository.find({
          where: { storeId },
          order: { destroyedAt: 'DESC', createdAt: 'DESC' },
        }),
      ]);

    const todayDate = this.toDateOnlyInDamascus(new Date());
    const productsByName = new Map(
      products.map((product) => [this.normalizeProductKey(product.name), product]),
    );
    const latestAdjustmentByProduct = new Map<string, InventoryAdjustment>();

    adjustments.forEach((adjustment) => {
      if (!latestAdjustmentByProduct.has(adjustment.productClientId)) {
        latestAdjustmentByProduct.set(adjustment.productClientId, adjustment);
      }
    });

    const purchasedByProduct = new Map<string, number>();
    const soldByProduct = new Map<string, number>();
    const refundedByProduct = new Map<string, number>();
    const destroyedByProduct = new Map<string, number>();
    const previousPurchasedByProduct = new Map<string, number>();
    const previousSoldByProduct = new Map<string, number>();
    const previousRefundedByProduct = new Map<string, number>();
    const previousDestroyedByProduct = new Map<string, number>();
    const todayReceivedByProduct = new Map<string, number>();

    purchases.forEach((purchase) => {
      if (purchase.purchaseKind === 'PAYMENT') {
        return;
      }

      const key = this.normalizeProductKey(purchase.productName);
      const product = productsByName.get(key);
      if (!product) {
        return;
      }

      if (purchase.purchaseDate === todayDate) {
        this.add(todayReceivedByProduct, product.clientProductId, purchase.quantity);
      }

      const adjustment = latestAdjustmentByProduct.get(product.clientProductId);
      if (adjustment && purchase.createdAt <= adjustment.adjustedAt) {
        return;
      }

      this.add(purchasedByProduct, product.clientProductId, purchase.quantity);
      if (purchase.purchaseDate < todayDate) {
        this.add(
          previousPurchasedByProduct,
          product.clientProductId,
          purchase.quantity,
        );
      }
    });

    orders.forEach((order) => {
      const orderDate = this.toDateOnlyInDamascus(order.orderedAt);

      order.items.forEach((item) => {
        const key = this.normalizeProductKey(item.productName);
        const product = productsByName.get(key);
        if (!product) {
          return;
        }

        const adjustment = latestAdjustmentByProduct.get(product.clientProductId);
        if (adjustment && order.orderedAt <= adjustment.adjustedAt) {
          return;
        }

        if (order.status === OrderStatus.REFUNDED) {
          this.add(refundedByProduct, product.clientProductId, item.quantity);
          if (orderDate < todayDate) {
            this.add(
              previousRefundedByProduct,
              product.clientProductId,
              item.quantity,
            );
          }
          return;
        }

        this.add(soldByProduct, product.clientProductId, item.quantity);
        if (orderDate < todayDate) {
          this.add(previousSoldByProduct, product.clientProductId, item.quantity);
        }
      });
    });

    destructions.forEach((destruction) => {
      const adjustment = latestAdjustmentByProduct.get(destruction.productClientId);
      if (adjustment && destruction.destroyedAt <= adjustment.adjustedAt) {
        return;
      }

      this.add(destroyedByProduct, destruction.productClientId, destruction.quantity);
      if (this.toDateOnlyInDamascus(destruction.destroyedAt) < todayDate) {
        this.add(
          previousDestroyedByProduct,
          destruction.productClientId,
          destruction.quantity,
        );
      }
    });

    const calculatedAt = new Date().toISOString();

    return products.map((product) => {
      const productId = product.clientProductId;
      const purchased = purchasedByProduct.get(productId) ?? 0;
      const sold = soldByProduct.get(productId) ?? 0;
      const refunded = refundedByProduct.get(productId) ?? 0;
      const destroyed = destroyedByProduct.get(productId) ?? 0;
      const previousPurchased = previousPurchasedByProduct.get(productId) ?? 0;
      const previousSold = previousSoldByProduct.get(productId) ?? 0;
      const previousRefunded = previousRefundedByProduct.get(productId) ?? 0;
      const previousDestroyed = previousDestroyedByProduct.get(productId) ?? 0;
      const inventoryBaseline =
        latestAdjustmentByProduct.get(productId)?.actualQuantity ?? 0;

      return {
        storeId,
        productId,
        productClientId: productId,
        name: product.name,
        unitType: product.unitType,
        sellPrice: product.price,
        costPrice: product.costPrice,
        remainingQty: Number(
          (inventoryBaseline + purchased - sold + refunded - destroyed).toFixed(3),
        ),
        previousRemainingQty: Number(
          (
            inventoryBaseline +
            previousPurchased -
            previousSold +
            previousRefunded -
            previousDestroyed
          ).toFixed(3),
        ),
        loggedToday: Number((todayReceivedByProduct.get(productId) ?? 0).toFixed(3)),
        calculatedAt,
      };
    });
  }

  private resolveStoreForRead(
    requestedStoreId: string | undefined,
    authUser: AuthUser,
  ): string | undefined {
    if (authUser.role === UserRole.CASHIER) {
      if (!authUser.storeId) {
        throw new ForbiddenException('Cashier account has no assigned store.');
      }

      if (requestedStoreId && requestedStoreId !== authUser.storeId) {
        throw new ForbiddenException(
          'Cashier can only view inventory for assigned store.',
        );
      }

      return authUser.storeId;
    }

    return requestedStoreId;
  }

  private add(map: Map<string, number>, key: string, value: number): void {
    map.set(key, (map.get(key) ?? 0) + value);
  }

  private normalizeProductKey(value: string): string {
    return value.trim().toLowerCase();
  }

  private toDateOnlyInDamascus(value: Date): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Damascus',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);

    const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
    const month = parts.find((part) => part.type === 'month')?.value ?? '00';
    const day = parts.find((part) => part.type === 'day')?.value ?? '00';
    return `${year}-${month}-${day}`;
  }
}
