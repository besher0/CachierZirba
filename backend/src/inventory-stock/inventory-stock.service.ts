import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { DailySettlement } from '../daily-settlements/entities/daily-settlement.entity';
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
    @InjectRepository(DailySettlement)
    private readonly dailySettlementRepository: Repository<DailySettlement>,
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

    const [
      products,
      purchases,
      orders,
      adjustments,
      destructions,
      settlements,
    ] = await Promise.all([
      this.productRepository.find({
        order: { name: 'ASC', createdAt: 'ASC' },
      }),
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
      this.dailySettlementRepository.find({
        where: { storeId },
        order: {
          businessDate: 'DESC',
          syncedAt: 'DESC',
          createdAt: 'DESC',
        },
        take: 1,
      }),
    ]);

    const todayDate = this.toDateOnlyInDamascus(new Date());
    const productsByName = new Map(
      products.map((product) => [
        this.normalizeProductKey(product.name),
        product,
      ]),
    );
    const latestAdjustmentByProduct = new Map<string, InventoryAdjustment>();
    const latestSettlement = settlements[0] ?? null;
    const latestSettlementAt = latestSettlement
      ? (latestSettlement.syncedAt ?? latestSettlement.createdAt)
      : null;
    const latestSettlementAdjustmentByProduct = new Map<
      string,
      InventoryAdjustment
    >();

    adjustments.forEach((adjustment) => {
      if (!latestAdjustmentByProduct.has(adjustment.productClientId)) {
        latestAdjustmentByProduct.set(adjustment.productClientId, adjustment);
      }

      if (
        latestSettlementAt &&
        adjustment.adjustedAt <= latestSettlementAt &&
        !latestSettlementAdjustmentByProduct.has(adjustment.productClientId)
      ) {
        latestSettlementAdjustmentByProduct.set(
          adjustment.productClientId,
          adjustment,
        );
      }
    });

    const purchasedByProduct = new Map<string, number>();
    const soldByProduct = new Map<string, number>();
    const refundedByProduct = new Map<string, number>();
    const destroyedByProduct = new Map<string, number>();
    const settlementPurchasedByProduct = new Map<string, number>();
    const settlementSoldByProduct = new Map<string, number>();
    const settlementRefundedByProduct = new Map<string, number>();
    const settlementDestroyedByProduct = new Map<string, number>();
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
        this.add(
          todayReceivedByProduct,
          product.clientProductId,
          purchase.quantity,
        );
      }

      const adjustment = latestAdjustmentByProduct.get(product.clientProductId);
      if (!adjustment || purchase.createdAt > adjustment.adjustedAt) {
        this.add(
          purchasedByProduct,
          product.clientProductId,
          purchase.quantity,
        );
      }

      const settlementAdjustment = latestSettlementAdjustmentByProduct.get(
        product.clientProductId,
      );
      if (
        latestSettlementAt &&
        purchase.createdAt <= latestSettlementAt &&
        (!settlementAdjustment ||
          purchase.createdAt > settlementAdjustment.adjustedAt)
      ) {
        this.add(
          settlementPurchasedByProduct,
          product.clientProductId,
          purchase.quantity,
        );
      }
    });

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const key = this.normalizeProductKey(item.productName);
        const product = productsByName.get(key);
        if (!product) {
          return;
        }

        const adjustment = latestAdjustmentByProduct.get(
          product.clientProductId,
        );
        const shouldApplyCurrent =
          !adjustment || order.orderedAt > adjustment.adjustedAt;
        if (shouldApplyCurrent && order.status === OrderStatus.REFUNDED) {
          this.add(refundedByProduct, product.clientProductId, item.quantity);
        }

        if (shouldApplyCurrent && order.status !== OrderStatus.REFUNDED) {
          this.add(soldByProduct, product.clientProductId, item.quantity);
        }

        const settlementAdjustment = latestSettlementAdjustmentByProduct.get(
          product.clientProductId,
        );
        const shouldApplyToSettlement =
          latestSettlementAt &&
          order.orderedAt <= latestSettlementAt &&
          (!settlementAdjustment ||
            order.orderedAt > settlementAdjustment.adjustedAt);

        if (shouldApplyToSettlement && order.status === OrderStatus.REFUNDED) {
          this.add(
            settlementRefundedByProduct,
            product.clientProductId,
            item.quantity,
          );
        }

        if (shouldApplyToSettlement && order.status !== OrderStatus.REFUNDED) {
          this.add(
            settlementSoldByProduct,
            product.clientProductId,
            item.quantity,
          );
        }
      });
    });

    destructions.forEach((destruction) => {
      const adjustment = latestAdjustmentByProduct.get(
        destruction.productClientId,
      );
      if (!adjustment || destruction.destroyedAt > adjustment.adjustedAt) {
        this.add(
          destroyedByProduct,
          destruction.productClientId,
          destruction.quantity,
        );
      }

      const settlementAdjustment = latestSettlementAdjustmentByProduct.get(
        destruction.productClientId,
      );
      if (
        latestSettlementAt &&
        destruction.destroyedAt <= latestSettlementAt &&
        (!settlementAdjustment ||
          destruction.destroyedAt > settlementAdjustment.adjustedAt)
      ) {
        this.add(
          settlementDestroyedByProduct,
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
      const inventoryBaseline =
        latestAdjustmentByProduct.get(productId)?.actualQuantity ?? 0;
      const settlementBaseline =
        latestSettlementAdjustmentByProduct.get(productId)?.actualQuantity ?? 0;
      // The previous remaining quantity is the stock closed at the latest
      // store settlement. Stores with no previous settlement fall back to zero.
      const settlementClosingQty = latestSettlementAt
        ? Number(
            (
              settlementBaseline +
              (settlementPurchasedByProduct.get(productId) ?? 0) -
              (settlementSoldByProduct.get(productId) ?? 0) +
              (settlementRefundedByProduct.get(productId) ?? 0) -
              (settlementDestroyedByProduct.get(productId) ?? 0)
            ).toFixed(3),
          )
        : 0;

      return {
        storeId,
        productId,
        productClientId: productId,
        name: product.name,
        unitType: product.unitType,
        sellPrice: product.price,
        costPrice: product.costPrice,
        remainingQty: Number(
          (inventoryBaseline + purchased - sold + refunded - destroyed).toFixed(
            3,
          ),
        ),
        previousRemainingQty: settlementClosingQty,
        loggedToday: Number(
          (todayReceivedByProduct.get(productId) ?? 0).toFixed(3),
        ),
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
