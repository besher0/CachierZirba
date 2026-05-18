import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { StoresService } from '../stores/stores.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';
import { PaymentMethod } from './enums/payment-method.enum';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly storesService: StoresService,
  ) {}

  async create(dto: CreateOrderDto, authUser: AuthUser): Promise<Order> {
    const scopedStoreId = this.resolveStoreForWrite(dto.storeId, authUser);
    await this.storesService.findById(scopedStoreId);

    const existing = await this.orderRepository.findOne({
      where: { clientOrderId: dto.clientOrderId },
      relations: { store: true },
    });

    if (existing) {
      return existing;
    }

    try {
      const order = this.orderRepository.create({
        ...dto,
        storeId: scopedStoreId,
        cashierName: dto.cashierName ?? null,
        status: dto.status ?? OrderStatus.COMPLETED,
        paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH,
        discount: dto.discount ?? 0,
        tax: dto.tax ?? 0,
        note: dto.note ?? null,
        orderedAt: dto.orderedAt ? new Date(dto.orderedAt) : new Date(),
        syncedAt: new Date(),
      });

      const saved = await this.orderRepository.save(order);
      return this.findById(saved.id);
    } catch (error: unknown) {
      if (this.isSqliteUniqueConstraintError(error)) {
        return this.findByClientOrderId(dto.clientOrderId);
      }
      throw error;
    }
  }

  async findAll(query: ListOrdersQueryDto, authUser: AuthUser): Promise<Order[]> {
    const qb = this.orderRepository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.store', 'store')
      .orderBy('o.orderedAt', 'DESC');

    const scopedStoreId = this.resolveStoreForRead(query.storeId, authUser);
    if (scopedStoreId) {
      qb.andWhere('o.storeId = :storeId', { storeId: scopedStoreId });
    }

    if (query.status) {
      qb.andWhere('o.status = :status', { status: query.status });
    }

    if (query.from) {
      qb.andWhere('o.orderedAt >= :from', { from: query.from });
    }

    if (query.to) {
      qb.andWhere('o.orderedAt <= :to', { to: query.to });
    }

    return qb.getMany();
  }

  private async findById(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: { store: true },
    });

    if (!order) {
      throw new Error(`Order ${id} was not found.`);
    }

    return order;
  }

  private async findByClientOrderId(clientOrderId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { clientOrderId },
      relations: { store: true },
    });

    if (!order) {
      throw new Error(`Order with clientOrderId ${clientOrderId} was not found.`);
    }

    return order;
  }

  private isSqliteUniqueConstraintError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const candidate = error as QueryFailedError & { message?: string };
    return candidate.message?.includes('UNIQUE constraint failed') ?? false;
  }

  private resolveStoreForWrite(requestedStoreId: string, authUser: AuthUser): string {
    if (authUser.role === UserRole.CASHIER) {
      if (!authUser.storeId) {
        throw new ForbiddenException('Cashier account has no assigned store.');
      }

      if (requestedStoreId !== authUser.storeId) {
        throw new ForbiddenException('Cashier can only create orders for assigned store.');
      }

      return authUser.storeId;
    }

    return requestedStoreId;
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
        throw new ForbiddenException('Cashier can only view assigned store orders.');
      }

      return authUser.storeId;
    }

    return requestedStoreId;
  }
}