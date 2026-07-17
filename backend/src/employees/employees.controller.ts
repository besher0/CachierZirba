import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CreateEmployeeAbsenceDto } from './dto/create-employee-absence.dto';
import { CreateEmployeeWithdrawalDto } from './dto/create-employee-withdrawal.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeAbsence } from './entities/employee-absence.entity';
import { EmployeeWithdrawal } from './entities/employee-withdrawal.entity';
import { Employee } from './entities/employee.entity';
import { EmployeesService } from './employees.service';

@Roles(UserRole.ADMIN, UserRole.CASHIER)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findEmployees(
    @Query() query: ListEmployeesQueryDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<Employee[]> {
    return this.employeesService.findEmployees(query.storeId, authUser);
  }

  @Post()
  createEmployee(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<Employee> {
    return this.employeesService.createEmployee(dto, authUser);
  }

  @Patch(':clientEmployeeId')
  updateEmployee(
    @Param('clientEmployeeId') clientEmployeeId: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<Employee> {
    return this.employeesService.updateEmployee(clientEmployeeId, dto, authUser);
  }

  @Get('absences')
  findAbsences(
    @Query() query: ListEmployeesQueryDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<EmployeeAbsence[]> {
    return this.employeesService.findAbsences(query.storeId, authUser);
  }

  @Post('absences')
  createAbsence(
    @Body() dto: CreateEmployeeAbsenceDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<EmployeeAbsence> {
    return this.employeesService.createAbsence(dto, authUser);
  }

  @Delete('absences/:clientAbsenceId')
  removeAbsence(
    @Param('clientAbsenceId') clientAbsenceId: string,
    @CurrentUser() authUser: AuthUser,
  ): Promise<{ deleted: true }> {
    return this.employeesService.removeAbsence(clientAbsenceId, authUser);
  }

  @Get('withdrawals')
  findWithdrawals(
    @Query() query: ListEmployeesQueryDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<EmployeeWithdrawal[]> {
    return this.employeesService.findWithdrawals(query, authUser);
  }

  @Post('withdrawals')
  createWithdrawal(
    @Body() dto: CreateEmployeeWithdrawalDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<EmployeeWithdrawal> {
    return this.employeesService.createWithdrawal(dto, authUser);
  }

  @Delete('withdrawals/:clientWithdrawalId')
  removeWithdrawal(
    @Param('clientWithdrawalId') clientWithdrawalId: string,
    @CurrentUser() authUser: AuthUser,
  ): Promise<{ deleted: true }> {
    return this.employeesService.removeWithdrawal(clientWithdrawalId, authUser);
  }
}
