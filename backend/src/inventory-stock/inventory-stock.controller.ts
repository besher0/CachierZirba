import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { ListInventoryStockQueryDto } from './dto/list-inventory-stock-query.dto';
import { InventoryStockRow } from './interfaces/inventory-stock-row.interface';
import { InventoryStockService } from './inventory-stock.service';

@Roles(UserRole.ADMIN, UserRole.CASHIER)
@Controller('inventory-stock')
export class InventoryStockController {
  constructor(private readonly inventoryStockService: InventoryStockService) {}

  @Get()
  findAll(
    @Query() query: ListInventoryStockQueryDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<InventoryStockRow[]> {
    return this.inventoryStockService.findAll(query, authUser);
  }
}
