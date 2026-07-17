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
import { DailySettlement } from '../daily-settlements/entities/daily-settlement.entity';
import { StoresService } from '../stores/stores.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ListExpensesQueryDto } from './dto/list-expenses-query.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { Expense } from './entities/expense.entity';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(DailySettlement)
    private readonly dailySettlementRepository: Repository<DailySettlement>,
    private readonly storesService: StoresService,
  ) {}

  async create(dto: CreateExpenseDto, authUser: AuthUser): Promise<Expense> {
    const scopedStoreId = this.resolveStoreForWrite(dto.storeId, authUser);
    await this.storesService.findById(scopedStoreId);

    const existing = await this.expenseRepository.findOne({
      where: { clientExpenseId: dto.clientExpenseId },
      relations: { store: true },
    });

    if (existing) {
      return existing;
    }

    try {
      const cycleStartClosureId =
        dto.cycleStartClosureId === undefined
          ? await this.findCurrentCycleStartClosureId(scopedStoreId)
          : dto.cycleStartClosureId;
      const record = this.expenseRepository.create({
        ...dto,
        storeId: scopedStoreId,
        cycleStartClosureId,
        imageUrl: dto.imageUrl?.trim() || null,
        note: dto.note ?? null,
        syncedAt: dto.syncedAt ? new Date(dto.syncedAt) : new Date(),
      });

      const saved = await this.expenseRepository.save(record);
      return this.findById(saved.id);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        return this.findByClientExpenseId(dto.clientExpenseId);
      }

      throw error;
    }
  }

  async update(
    clientExpenseId: string,
    dto: UpdateExpenseDto,
    authUser: AuthUser,
  ): Promise<Expense> {
    const record = await this.findByClientExpenseId(clientExpenseId);
    this.assertRecordWritePermission(record, authUser);

    if (dto.expenseDate !== undefined) {
      record.expenseDate = dto.expenseDate;
    }

    if (dto.category !== undefined) {
      record.category = dto.category;
    }

    if (dto.description !== undefined) {
      record.description = dto.description;
    }

    if (dto.amount !== undefined) {
      record.amount = dto.amount;
    }

    if (dto.imageUrl !== undefined) {
      record.imageUrl = dto.imageUrl?.trim() || null;
    }

    if (dto.note !== undefined) {
      record.note = dto.note;
    }

    record.syncedAt = dto.syncedAt ? new Date(dto.syncedAt) : new Date();

    await this.expenseRepository.save(record);
    return this.findById(record.id);
  }

  async remove(clientExpenseId: string, authUser: AuthUser): Promise<{ deleted: true }> {
    const record = await this.findByClientExpenseId(clientExpenseId);
    this.assertRecordWritePermission(record, authUser);

    await this.expenseRepository.delete({ id: record.id });
    return { deleted: true };
  }

  async findAll(query: ListExpensesQueryDto, authUser: AuthUser): Promise<Expense[]> {
    const qb = this.expenseRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.store', 'store')
      .orderBy('e.expenseDate', 'DESC')
      .addOrderBy('e.createdAt', 'DESC');

    const scopedStoreId = this.resolveStoreForRead(query.storeId, authUser);
    if (scopedStoreId) {
      qb.andWhere('e.storeId = :storeId', { storeId: scopedStoreId });
    }

    if (query.from) {
      qb.andWhere('e.expenseDate >= :fromDate', { fromDate: query.from.slice(0, 10) });
    }

    if (query.to) {
      qb.andWhere('e.expenseDate <= :toDate', { toDate: query.to.slice(0, 10) });
    }

    if (query.category) {
      qb.andWhere('e.category = :category', { category: query.category });
    }

    if (query.description) {
      qb.andWhere('LOWER(e.description) LIKE LOWER(:description)', {
        description: `%${query.description}%`,
      });
    }

    if (query.cycleStartClosureId) {
      qb.andWhere('e.cycleStartClosureId = :cycleStartClosureId', {
        cycleStartClosureId: query.cycleStartClosureId,
      });
    } else if (query.unanchoredCycle) {
      qb.andWhere('e.cycleStartClosureId IS NULL');
    }

    return qb.getMany();
  }

  private async findById(id: string): Promise<Expense> {
    const record = await this.expenseRepository.findOne({
      where: { id },
      relations: { store: true },
    });

    if (!record) {
      throw new NotFoundException(`Expense ${id} was not found.`);
    }

    return record;
  }

  private async findByClientExpenseId(clientExpenseId: string): Promise<Expense> {
    const record = await this.expenseRepository.findOne({
      where: { clientExpenseId },
      relations: { store: true },
    });

    if (!record) {
      throw new NotFoundException(
        `Expense with clientExpenseId ${clientExpenseId} was not found.`,
      );
    }

    return record;
  }

  private async findCurrentCycleStartClosureId(
    storeId: string,
  ): Promise<string | null> {
    const latestSettlement = await this.dailySettlementRepository.findOne({
      where: { storeId },
      order: { createdAt: 'DESC' },
    });

    return latestSettlement?.clientClosureId ?? null;
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
        throw new ForbiddenException('Cashier can only view expenses for assigned store.');
      }

      return authUser.storeId;
    }

    return requestedStoreId;
  }

  private resolveStoreForWrite(requestedStoreId: string, authUser: AuthUser): string {
    if (authUser.role === UserRole.ADMIN) {
      return requestedStoreId;
    }

    if (!authUser.storeId) {
      throw new ForbiddenException('Cashier account has no assigned store.');
    }

    if (requestedStoreId !== authUser.storeId) {
      throw new ForbiddenException('Cashier can only manage expenses for assigned store.');
    }

    return authUser.storeId;
  }

  private assertRecordWritePermission(record: Expense, authUser: AuthUser): void {
    if (authUser.role === UserRole.ADMIN) {
      return;
    }

    if (!authUser.storeId || authUser.storeId !== record.storeId) {
      throw new ForbiddenException('Cashier can only manage expenses for assigned store.');
    }
  }

}
