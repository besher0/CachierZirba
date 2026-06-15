import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ListExpensesQueryDto } from './dto/list-expenses-query.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { Expense } from './entities/expense.entity';
import { ExpensesService } from './expenses.service';

@Roles(UserRole.ADMIN, UserRole.CASHIER)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  findAll(
    @Query() query: ListExpensesQueryDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<Expense[]> {
    return this.expensesService.findAll(query, authUser);
  }

  @Roles(UserRole.ADMIN, UserRole.CASHIER)
  @Post()
  create(@Body() dto: CreateExpenseDto, @CurrentUser() authUser: AuthUser): Promise<Expense> {
    return this.expensesService.create(dto, authUser);
  }

  @Roles(UserRole.ADMIN, UserRole.CASHIER)
  @Patch(':clientExpenseId')
  update(
    @Param('clientExpenseId') clientExpenseId: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<Expense> {
    return this.expensesService.update(clientExpenseId, dto, authUser);
  }

  @Roles(UserRole.ADMIN, UserRole.CASHIER)
  @Delete(':clientExpenseId')
  remove(
    @Param('clientExpenseId') clientExpenseId: string,
    @CurrentUser() authUser: AuthUser,
  ): Promise<{ deleted: true }> {
    return this.expensesService.remove(clientExpenseId, authUser);
  }
}
