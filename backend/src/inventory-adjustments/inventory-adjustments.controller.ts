import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import { ListInventoryAdjustmentsQueryDto } from './dto/list-inventory-adjustments-query.dto';
import { InventoryAdjustment } from './entities/inventory-adjustment.entity';
import { InventoryAdjustmentsService } from './inventory-adjustments.service';

@Roles(UserRole.ADMIN, UserRole.CASHIER)
@Controller('inventory-adjustments')
export class InventoryAdjustmentsController {
  constructor(
    private readonly inventoryAdjustmentsService: InventoryAdjustmentsService,
  ) {}

  @Get()
  findAll(
    @Query() query: ListInventoryAdjustmentsQueryDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<InventoryAdjustment[]> {
    return this.inventoryAdjustmentsService.findAll(query, authUser);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(
    @Body() dto: CreateInventoryAdjustmentDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<InventoryAdjustment> {
    return this.inventoryAdjustmentsService.create(dto, authUser);
  }
}
