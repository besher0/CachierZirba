import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { isUniqueConstraintError } from '../database/is-unique-constraint-error';
import { StoresService } from '../stores/stores.service';
import { CreateDailySettlementDto } from './dto/create-daily-settlement.dto';
import { ListDailySettlementsQueryDto } from './dto/list-daily-settlements-query.dto';
import { DailySettlement } from './entities/daily-settlement.entity';

@Injectable()
export class DailySettlementsService {
  constructor(
    @InjectRepository(DailySettlement)
    private readonly dailySettlementRepository: Repository<DailySettlement>,
    private readonly storesService: StoresService,
  ) {}

  async createOrUpdate(dto: CreateDailySettlementDto, authUser: AuthUser): Promise<DailySettlement> {
    const scopedStoreId = this.resolveStoreForWrite(dto.storeId, authUser);
    await this.storesService.findById(scopedStoreId);

    const existingClientRecord = await this.dailySettlementRepository.findOne({
      where: { clientClosureId: dto.clientClosureId },
      relations: { store: true },
    });

    if (existingClientRecord) {
      return existingClientRecord;
    }

    const sameDayRecord = await this.dailySettlementRepository.findOne({
      where: {
        storeId: scopedStoreId,
        businessDate: dto.businessDate,
      },
      relations: { store: true },
    });

    if (sameDayRecord) {
      sameDayRecord.clientClosureId = dto.clientClosureId;
      sameDayRecord.cashBoxAmount = dto.cashBoxAmount;
      sameDayRecord.sharesAmount = dto.sharesAmount;
      sameDayRecord.actualRemainingAmount = dto.actualRemainingAmount;
      sameDayRecord.expectedRevenue = dto.expectedRevenue ?? sameDayRecord.expectedRevenue;
      sameDayRecord.note = dto.note ?? null;
      sameDayRecord.syncedAt = dto.syncedAt ? new Date(dto.syncedAt) : new Date();

      return this.dailySettlementRepository.save(sameDayRecord);
    }

    try {
      const record = this.dailySettlementRepository.create({
        ...dto,
        storeId: scopedStoreId,
        actualRemainingAmount: dto.actualRemainingAmount,
        expectedRevenue: dto.expectedRevenue ?? 0,
        note: dto.note ?? null,
        syncedAt: dto.syncedAt ? new Date(dto.syncedAt) : new Date(),
      });

      const saved = await this.dailySettlementRepository.save(record);
      return this.findById(saved.id);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        const byClientClosure = await this.dailySettlementRepository.findOne({
          where: { clientClosureId: dto.clientClosureId },
          relations: { store: true },
        });

        if (byClientClosure) {
          return byClientClosure;
        }
      }

      throw error;
    }
  }

  async findAll(
    query: ListDailySettlementsQueryDto,
    authUser: AuthUser,
  ): Promise<DailySettlement[]> {
    const qb = this.dailySettlementRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.store', 'store')
      .orderBy('s.businessDate', 'DESC');

    const scopedStoreId = this.resolveStoreForRead(query.storeId, authUser);
    if (scopedStoreId) {
      qb.andWhere('s.storeId = :storeId', { storeId: scopedStoreId });
    }

    if (query.from) {
      qb.andWhere('s.businessDate >= :fromDate', { fromDate: query.from.slice(0, 10) });
    }

    if (query.to) {
      qb.andWhere('s.businessDate <= :toDate', { toDate: query.to.slice(0, 10) });
    }

    return qb.getMany();
  }

  private async findById(id: string): Promise<DailySettlement> {
    const record = await this.dailySettlementRepository.findOne({
      where: { id },
      relations: { store: true },
    });

    if (!record) {
      throw new Error(`Daily settlement ${id} was not found.`);
    }

    return record;
  }

  private resolveStoreForWrite(requestedStoreId: string, authUser: AuthUser): string {
    if (authUser.role === UserRole.CASHIER) {
      if (!authUser.storeId) {
        throw new ForbiddenException('Cashier account has no assigned store.');
      }

      if (requestedStoreId !== authUser.storeId) {
        throw new ForbiddenException(
          'Cashier can only create daily settlement for assigned store.',
        );
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
        throw new ForbiddenException(
          'Cashier can only view daily settlements for assigned store.',
        );
      }

      return authUser.storeId;
    }

    return requestedStoreId;
  }
}
