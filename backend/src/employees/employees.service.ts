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
import { CreateEmployeeAbsenceDto } from './dto/create-employee-absence.dto';
import { CreateEmployeeWithdrawalDto } from './dto/create-employee-withdrawal.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeAbsence } from './entities/employee-absence.entity';
import { EmployeeWithdrawal } from './entities/employee-withdrawal.entity';
import { Employee } from './entities/employee.entity';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(EmployeeAbsence)
    private readonly absenceRepository: Repository<EmployeeAbsence>,
    @InjectRepository(EmployeeWithdrawal)
    private readonly withdrawalRepository: Repository<EmployeeWithdrawal>,
    private readonly storesService: StoresService,
  ) {}

  async findEmployees(storeId: string | undefined, authUser: AuthUser): Promise<Employee[]> {
    const scopedStoreId = this.resolveStoreForRead(storeId, authUser);
    return this.employeeRepository.find({
      where: scopedStoreId ? { storeId: scopedStoreId } : {},
      order: { name: 'ASC', createdAt: 'ASC' },
    });
  }

  async createEmployee(dto: CreateEmployeeDto, authUser: AuthUser): Promise<Employee> {
    const storeId = await this.resolveStoreForWrite(dto.storeId, authUser);
    const existing = await this.employeeRepository.findOne({
      where: { clientEmployeeId: dto.clientEmployeeId },
    });
    if (existing) {
      return existing;
    }

    try {
      return await this.employeeRepository.save(
        this.employeeRepository.create({
          ...dto,
          storeId,
          payrollWeekStartDay: dto.payrollWeekStartDay ?? 1,
          isActive: dto.isActive ?? true,
          syncedAt: dto.syncedAt ? new Date(dto.syncedAt) : new Date(),
        }),
      );
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        return this.findEmployeeByClientId(dto.clientEmployeeId);
      }
      throw error;
    }
  }

  async updateEmployee(
    clientEmployeeId: string,
    dto: UpdateEmployeeDto,
    authUser: AuthUser,
  ): Promise<Employee> {
    const record = await this.findEmployeeByClientId(clientEmployeeId);
    this.assertRecordWritePermission(record.storeId, authUser);

    if (dto.name !== undefined) {
      record.name = dto.name;
    }

    if (dto.weeklySalary !== undefined) {
      record.weeklySalary = dto.weeklySalary;
    }

    if (dto.payrollWeekStartDay !== undefined) {
      record.payrollWeekStartDay = dto.payrollWeekStartDay;
    }

    if (dto.isActive !== undefined) {
      record.isActive = dto.isActive;
    }

    record.syncedAt = dto.syncedAt ? new Date(dto.syncedAt) : new Date();

    return this.employeeRepository.save(record);
  }

  async findAbsences(
    storeId: string | undefined,
    authUser: AuthUser,
  ): Promise<EmployeeAbsence[]> {
    const scopedStoreId = this.resolveStoreForRead(storeId, authUser);
    return this.absenceRepository.find({
      where: scopedStoreId ? { storeId: scopedStoreId } : {},
      order: { absenceDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async createAbsence(
    dto: CreateEmployeeAbsenceDto,
    authUser: AuthUser,
  ): Promise<EmployeeAbsence> {
    const storeId = await this.resolveStoreForWrite(dto.storeId, authUser);
    await this.assertEmployeeBelongsToStore(dto.employeeClientId, storeId);
    const existing = await this.absenceRepository.findOne({
      where: { clientAbsenceId: dto.clientAbsenceId },
    });
    if (existing) {
      return existing;
    }

    try {
      return await this.absenceRepository.save(
        this.absenceRepository.create({
          ...dto,
          storeId,
          note: dto.note ?? null,
          syncedAt: dto.syncedAt ? new Date(dto.syncedAt) : new Date(),
        }),
      );
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        return this.findAbsenceByClientId(dto.clientAbsenceId);
      }
      throw error;
    }
  }

  async removeAbsence(
    clientAbsenceId: string,
    authUser: AuthUser,
  ): Promise<{ deleted: true }> {
    const record = await this.absenceRepository.findOne({
      where: { clientAbsenceId },
    });
    if (!record) {
      return { deleted: true };
    }

    this.assertRecordWritePermission(record.storeId, authUser);
    await this.absenceRepository.delete({ id: record.id });
    return { deleted: true };
  }

  async findWithdrawals(
    storeId: string | undefined,
    authUser: AuthUser,
  ): Promise<EmployeeWithdrawal[]> {
    const scopedStoreId = this.resolveStoreForRead(storeId, authUser);
    return this.withdrawalRepository.find({
      where: scopedStoreId ? { storeId: scopedStoreId } : {},
      order: { withdrawalDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async createWithdrawal(
    dto: CreateEmployeeWithdrawalDto,
    authUser: AuthUser,
  ): Promise<EmployeeWithdrawal> {
    const storeId = await this.resolveStoreForWrite(dto.storeId, authUser);
    await this.assertEmployeeBelongsToStore(dto.employeeClientId, storeId);
    const existing = await this.withdrawalRepository.findOne({
      where: { clientWithdrawalId: dto.clientWithdrawalId },
    });
    if (existing) {
      return existing;
    }

    try {
      return await this.withdrawalRepository.save(
        this.withdrawalRepository.create({
          ...dto,
          storeId,
          note: dto.note ?? null,
          syncedAt: dto.syncedAt ? new Date(dto.syncedAt) : new Date(),
        }),
      );
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        return this.findWithdrawalByClientId(dto.clientWithdrawalId);
      }
      throw error;
    }
  }

  async removeWithdrawal(
    clientWithdrawalId: string,
    authUser: AuthUser,
  ): Promise<{ deleted: true }> {
    const record = await this.withdrawalRepository.findOne({
      where: { clientWithdrawalId },
    });
    if (!record) {
      return { deleted: true };
    }

    this.assertRecordWritePermission(record.storeId, authUser);
    await this.withdrawalRepository.delete({ id: record.id });
    return { deleted: true };
  }

  private async resolveStoreForWrite(requestedStoreId: string, authUser: AuthUser): Promise<string> {
    if (authUser.role === UserRole.CASHIER) {
      if (!authUser.storeId || authUser.storeId !== requestedStoreId) {
        throw new ForbiddenException('Cashier can only manage employees for assigned store.');
      }
    }

    await this.storesService.findById(requestedStoreId);
    return requestedStoreId;
  }

  private resolveStoreForRead(
    requestedStoreId: string | undefined,
    authUser: AuthUser,
  ): string | undefined {
    if (authUser.role !== UserRole.CASHIER) {
      return requestedStoreId;
    }

    if (!authUser.storeId) {
      throw new ForbiddenException('Cashier account has no assigned store.');
    }
    if (requestedStoreId && requestedStoreId !== authUser.storeId) {
      throw new ForbiddenException('Cashier can only view employees for assigned store.');
    }
    return authUser.storeId;
  }

  private assertRecordWritePermission(storeId: string, authUser: AuthUser): void {
    if (authUser.role === UserRole.CASHIER && authUser.storeId !== storeId) {
      throw new ForbiddenException('Cashier can only manage employees for assigned store.');
    }
  }

  private async assertEmployeeBelongsToStore(
    clientEmployeeId: string,
    storeId: string,
  ): Promise<void> {
    const employee = await this.employeeRepository.findOne({
      where: { clientEmployeeId, storeId },
    });
    if (!employee) {
      throw new NotFoundException(`Employee ${clientEmployeeId} was not found in this store.`);
    }
  }

  private async findEmployeeByClientId(clientEmployeeId: string): Promise<Employee> {
    const record = await this.employeeRepository.findOne({ where: { clientEmployeeId } });
    if (!record) {
      throw new NotFoundException(`Employee ${clientEmployeeId} was not found.`);
    }
    return record;
  }

  private async findAbsenceByClientId(clientAbsenceId: string): Promise<EmployeeAbsence> {
    const record = await this.absenceRepository.findOne({ where: { clientAbsenceId } });
    if (!record) {
      throw new NotFoundException(`Employee absence ${clientAbsenceId} was not found.`);
    }
    return record;
  }

  private async findWithdrawalByClientId(
    clientWithdrawalId: string,
  ): Promise<EmployeeWithdrawal> {
    const record = await this.withdrawalRepository.findOne({
      where: { clientWithdrawalId },
    });
    if (!record) {
      throw new NotFoundException(`Employee withdrawal ${clientWithdrawalId} was not found.`);
    }
    return record;
  }

}
