import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { isUniqueConstraintError } from '../database/is-unique-constraint-error';
import { StoresService } from '../stores/stores.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { ListPurchasesQueryDto } from './dto/list-purchases-query.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { Purchase } from './entities/purchase.entity';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    private readonly storesService: StoresService,
  ) {}

  async create(dto: CreatePurchaseDto, authUser: AuthUser): Promise<Purchase> {
    const scopedStoreId = this.resolveStoreForWrite(dto.storeId, authUser);
    await this.storesService.findById(scopedStoreId);

    const existing = await this.purchaseRepository.findOne({
      where: { clientPurchaseId: dto.clientPurchaseId },
      relations: { store: true },
    });

    if (existing) {
      return existing;
    }

    try {
      const record = this.purchaseRepository.create({
        ...dto,
        storeId: scopedStoreId,
        purchaseKind: dto.purchaseKind ?? 'SUPPLY',
        sellPrice: dto.sellPrice ?? null,
        paymentAmount: dto.paymentAmount ?? 0,
        note: dto.note ?? null,
        syncedAt: dto.syncedAt ? new Date(dto.syncedAt) : new Date(),
      });

      const saved = await this.purchaseRepository.save(record);
      return this.findById(saved.id);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        return this.findByClientPurchaseId(dto.clientPurchaseId);
      }

      throw error;
    }
  }

  async update(
    clientPurchaseId: string,
    dto: UpdatePurchaseDto,
    authUser: AuthUser,
  ): Promise<Purchase> {
    const record = await this.findByClientPurchaseId(clientPurchaseId);
    this.assertRecordWritePermission(record, authUser);

    if (dto.productName !== undefined) {
      record.productName = dto.productName;
    }

    if (dto.quantity !== undefined) {
      record.quantity = dto.quantity;
    }

    if (dto.unitCost !== undefined) {
      record.unitCost = dto.unitCost;
    }

    if (dto.totalCost !== undefined) {
      record.totalCost = dto.totalCost;
    }

    if (dto.purchaseKind !== undefined) {
      record.purchaseKind = dto.purchaseKind;
    }

    if (dto.sellPrice !== undefined) {
      record.sellPrice = dto.sellPrice;
    }

    if (dto.paymentAmount !== undefined) {
      record.paymentAmount = dto.paymentAmount;
    }

    if (dto.purchaseDate !== undefined) {
      record.purchaseDate = dto.purchaseDate;
    }

    if (dto.note !== undefined) {
      record.note = dto.note;
    }

    record.syncedAt = dto.syncedAt ? new Date(dto.syncedAt) : new Date();

    await this.purchaseRepository.save(record);
    return this.findById(record.id);
  }

  async remove(
    clientPurchaseId: string,
    authUser: AuthUser,
  ): Promise<{ deleted: true }> {
    const record = await this.findByClientPurchaseId(clientPurchaseId);
    this.assertRecordWritePermission(record, authUser);

    await this.purchaseRepository.delete({ id: record.id });
    return { deleted: true };
  }

  async findAll(
    query: ListPurchasesQueryDto,
    authUser: AuthUser,
  ): Promise<Purchase[]> {
    const qb = this.purchaseRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.store', 'store')
      .orderBy('p.purchaseDate', 'DESC')
      .addOrderBy('p.createdAt', 'DESC');

    const scopedStoreId = this.resolveStoreForRead(query.storeId, authUser);
    if (scopedStoreId) {
      qb.andWhere('p.storeId = :storeId', { storeId: scopedStoreId });
    }

    if (query.from) {
      qb.andWhere('p.purchaseDate >= :fromDate', {
        fromDate: query.from.slice(0, 10),
      });
    }

    if (query.to) {
      qb.andWhere('p.purchaseDate <= :toDate', {
        toDate: query.to.slice(0, 10),
      });
    }

    if (query.product) {
      qb.andWhere('LOWER(p.productName) LIKE LOWER(:product)', {
        product: `%${query.product}%`,
      });
    }

    return qb.getMany();
  }

  private async findById(id: string): Promise<Purchase> {
    const record = await this.purchaseRepository.findOne({
      where: { id },
      relations: { store: true },
    });

    if (!record) {
      throw new NotFoundException(`Purchase ${id} was not found.`);
    }

    return record;
  }

  private async findByClientPurchaseId(
    clientPurchaseId: string,
  ): Promise<Purchase> {
    const record = await this.purchaseRepository.findOne({
      where: { clientPurchaseId },
      relations: { store: true },
    });

    if (!record) {
      throw new NotFoundException(
        `Purchase with clientPurchaseId ${clientPurchaseId} was not found.`,
      );
    }

    return record;
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
          'Cashier can only view purchases for assigned store.',
        );
      }

      return authUser.storeId;
    }

    return requestedStoreId;
  }

  private resolveStoreForWrite(
    requestedStoreId: string,
    authUser: AuthUser,
  ): string {
    if (authUser.role === UserRole.ADMIN) {
      return requestedStoreId;
    }

    if (!authUser.storeId) {
      throw new ForbiddenException('Cashier account has no assigned store.');
    }

    if (requestedStoreId !== authUser.storeId) {
      throw new ForbiddenException(
        'Cashier can only manage purchases for assigned store.',
      );
    }

    return authUser.storeId;
  }

  private assertRecordWritePermission(
    record: Purchase,
    authUser: AuthUser,
  ): void {
    if (authUser.role === UserRole.ADMIN) {
      return;
    }

    if (!authUser.storeId || authUser.storeId !== record.storeId) {
      throw new ForbiddenException(
        'Cashier can only manage purchases for assigned store.',
      );
    }
  }
}
