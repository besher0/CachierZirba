import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { StoresService } from '../stores/stores.service';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import { ListInventoryAdjustmentsQueryDto } from './dto/list-inventory-adjustments-query.dto';
import { InventoryAdjustment } from './entities/inventory-adjustment.entity';

@Injectable()
export class InventoryAdjustmentsService {
  constructor(
    @InjectRepository(InventoryAdjustment)
    private readonly adjustmentRepository: Repository<InventoryAdjustment>,
    private readonly storesService: StoresService,
  ) {}

  async create(
    dto: CreateInventoryAdjustmentDto,
    authUser: AuthUser,
  ): Promise<InventoryAdjustment> {
    if (authUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admin accounts can adjust inventory.');
    }

    await this.storesService.findById(dto.storeId);
    const existing = await this.adjustmentRepository.findOne({
      where: { clientAdjustmentId: dto.clientAdjustmentId },
      relations: { store: true },
    });
    if (existing) {
      return existing;
    }

    try {
      const record = this.adjustmentRepository.create({
        clientAdjustmentId: dto.clientAdjustmentId,
        storeId: dto.storeId,
        productClientId: dto.productClientId,
        actualQuantity: dto.actualQuantity,
        adjustedAt: new Date(dto.adjustedAt),
        syncedAt: dto.syncedAt ? new Date(dto.syncedAt) : new Date(),
      });
      const saved = await this.adjustmentRepository.save(record);
      return this.findById(saved.id);
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        return this.findByClientAdjustmentId(dto.clientAdjustmentId);
      }
      throw error;
    }
  }

  async findAll(
    query: ListInventoryAdjustmentsQueryDto,
    authUser: AuthUser,
  ): Promise<InventoryAdjustment[]> {
    const storeId = this.resolveStoreForRead(query.storeId, authUser);
    const qb = this.adjustmentRepository
      .createQueryBuilder('adjustment')
      .leftJoinAndSelect('adjustment.store', 'store')
      .orderBy('adjustment.adjustedAt', 'DESC')
      .addOrderBy('adjustment.createdAt', 'DESC');

    if (storeId) {
      qb.andWhere('adjustment.storeId = :storeId', { storeId });
    }

    return qb.getMany();
  }

  private async findById(id: string): Promise<InventoryAdjustment> {
    const record = await this.adjustmentRepository.findOne({
      where: { id },
      relations: { store: true },
    });
    if (!record) {
      throw new NotFoundException(`Inventory adjustment ${id} was not found.`);
    }
    return record;
  }

  private async findByClientAdjustmentId(
    clientAdjustmentId: string,
  ): Promise<InventoryAdjustment> {
    const record = await this.adjustmentRepository.findOne({
      where: { clientAdjustmentId },
      relations: { store: true },
    });
    if (!record) {
      throw new NotFoundException(
        `Inventory adjustment ${clientAdjustmentId} was not found.`,
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
          'Cashier can only view inventory for assigned store.',
        );
      }
      return authUser.storeId;
    }
    return requestedStoreId;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    const candidate = error as QueryFailedError & {
      code?: string;
      message?: string;
    };
    return (
      candidate.code === '23505' ||
      candidate.message?.includes('UNIQUE constraint failed') === true
    );
  }
}
