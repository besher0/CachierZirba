import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { InventoryBalancesService } from '../inventory-balances/inventory-balances.service';
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
    private readonly inventoryBalancesService: InventoryBalancesService,
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

    const [products, balances, latestSnapshots, todayReceivedRows] =
      await Promise.all([
        this.productRepository.find({
          order: { name: 'ASC', createdAt: 'ASC' },
        }),
        this.inventoryBalancesService.findBalancesByStore(storeId),
        this.inventoryBalancesService.findLatestSnapshotsByStore(storeId),
        this.getReceivedRows(storeId, query.cycleStartedAt),
      ]);

    const productsByName = new Map(
      products.map((product) => [
        this.normalizeProductKey(product.name),
        product.clientProductId,
      ]),
    );
    const todayReceivedByProduct = new Map<string, number>();
    todayReceivedRows.forEach((row) => {
      const productClientId = productsByName.get(
        this.normalizeProductKey(row.productName),
      );
      if (!productClientId) {
        return;
      }
      todayReceivedByProduct.set(
        productClientId,
        (todayReceivedByProduct.get(productClientId) ?? 0) +
          Number(row.quantity),
      );
    });

    const balanceByProduct = new Map(
      balances.map((balance) => [
        balance.productClientId,
        Number(balance.quantity),
      ]),
    );
    const snapshotByProduct = new Map(
      latestSnapshots.map((snapshot) => [
        snapshot.productClientId,
        Number(snapshot.quantity),
      ]),
    );
    const calculatedAt = new Date().toISOString();

    return products.map((product) => {
      const productId = product.clientProductId;
      return {
        storeId,
        productId,
        productClientId: productId,
        name: product.name,
        unitType: product.unitType,
        sellPrice: product.price,
        costPrice: product.costPrice,
        remainingQty: this.roundQuantity(balanceByProduct.get(productId) ?? 0),
        previousRemainingQty: this.roundQuantity(
          snapshotByProduct.get(productId) ?? 0,
        ),
        loggedToday: this.roundQuantity(
          todayReceivedByProduct.get(productId) ?? 0,
        ),
        calculatedAt,
      };
    });
  }

  private async getReceivedRows(
    storeId: string,
    cycleStartedAt?: string,
  ): Promise<Array<{ productName: string; quantity: string | number }>> {
    const todayDate = this.toDateOnlyInDamascus(new Date());
    const qb = this.purchaseRepository
      .createQueryBuilder('purchase')
      .select('purchase.productName', 'productName')
      .addSelect('COALESCE(SUM(purchase.quantity), 0)', 'quantity')
      .where('purchase.storeId = :storeId', { storeId })
      .andWhere('purchase.purchaseKind <> :paymentKind', {
        paymentKind: 'PAYMENT',
      })
      .groupBy('purchase.productName');

    if (cycleStartedAt) {
      qb.andWhere('purchase.syncedAt > :cycleStartedAt', {
        cycleStartedAt: new Date(cycleStartedAt),
      });
    } else {
      qb.andWhere('purchase.purchaseDate = :todayDate', { todayDate });
    }

    return qb.getRawMany<{ productName: string; quantity: string | number }>();
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

  private roundQuantity(value: number): number {
    return Number(value.toFixed(3));
  }
}
