import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { ListPurchasesQueryDto } from './dto/list-purchases-query.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { Purchase } from './entities/purchase.entity';
import { PurchasesService } from './purchases.service';

@Roles(UserRole.ADMIN, UserRole.CASHIER)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get()
  findAll(
    @Query() query: ListPurchasesQueryDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<Purchase[]> {
    return this.purchasesService.findAll(query, authUser);
  }

  @Roles(UserRole.ADMIN, UserRole.CASHIER)
  @Post()
  create(@Body() dto: CreatePurchaseDto, @CurrentUser() authUser: AuthUser): Promise<Purchase> {
    return this.purchasesService.create(dto, authUser);
  }

  @Roles(UserRole.ADMIN, UserRole.CASHIER)
  @Patch(':clientPurchaseId')
  update(
    @Param('clientPurchaseId') clientPurchaseId: string,
    @Body() dto: UpdatePurchaseDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<Purchase> {
    return this.purchasesService.update(clientPurchaseId, dto, authUser);
  }

  @Roles(UserRole.ADMIN, UserRole.CASHIER)
  @Delete(':clientPurchaseId')
  remove(
    @Param('clientPurchaseId') clientPurchaseId: string,
    @CurrentUser() authUser: AuthUser,
  ): Promise<{ deleted: true }> {
    return this.purchasesService.remove(clientPurchaseId, authUser);
  }
}
