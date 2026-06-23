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
import { CreateInventoryDestructionDto } from './dto/create-inventory-destruction.dto';
import { ListInventoryDestructionsQueryDto } from './dto/list-inventory-destructions-query.dto';
import { InventoryDestruction } from './entities/inventory-destruction.entity';

@Injectable()
export class InventoryDestructionsService {
  constructor(
    @InjectRepository(InventoryDestruction)
    private readonly destructionRepository: Repository<InventoryDestruction>,
    private readonly storesService: StoresService,
  ) {}

  async create(
    dto: CreateInventoryDestructionDto,
    authUser: AuthUser,
  ): Promise<InventoryDestruction> {
    if (authUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admin accounts can record inventory destruction.');
    }

    await this.storesService.findById(dto.storeId);
    const existing = await this.destructionRepository.findOne({
      where: { clientDestructionId: dto.clientDestructionId },
      relations: { store: true },
    });
    if (existing) {
      return existing;
    }

    try {
      const record = this.destructionRepository.create({
        clientDestructionId: dto.clientDestructionId,
        storeId: dto.storeId,
        productClientId: dto.productClientId,
        quantity: dto.quantity,
        note: dto.note?.trim() || null,
        destroyedAt: new Date(dto.destroyedAt),
        syncedAt: dto.syncedAt ? new Date(dto.syncedAt) : new Date(),
      });
      const saved = await this.destructionRepository.save(record);
      return this.findById(saved.id);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        return this.findByClientDestructionId(dto.clientDestructionId);
      }
      throw error;
    }
  }

  async findAll(
    query: ListInventoryDestructionsQueryDto,
    authUser: AuthUser,
  ): Promise<InventoryDestruction[]> {
    const storeId = this.resolveStoreForRead(query.storeId, authUser);
    const qb = this.destructionRepository
      .createQueryBuilder('destruction')
      .leftJoinAndSelect('destruction.store', 'store')
      .orderBy('destruction.destroyedAt', 'DESC')
      .addOrderBy('destruction.createdAt', 'DESC');

    if (storeId) {
      qb.andWhere('destruction.storeId = :storeId', { storeId });
    }

    return qb.getMany();
  }

  private async findById(id: string): Promise<InventoryDestruction> {
    const record = await this.destructionRepository.findOne({
      where: { id },
      relations: { store: true },
    });
    if (!record) {
      throw new NotFoundException(`Inventory destruction ${id} was not found.`);
    }
    return record;
  }

  private async findByClientDestructionId(
    clientDestructionId: string,
  ): Promise<InventoryDestruction> {
    const record = await this.destructionRepository.findOne({
      where: { clientDestructionId },
      relations: { store: true },
    });
    if (!record) {
      throw new NotFoundException(
        `Inventory destruction ${clientDestructionId} was not found.`,
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
}
