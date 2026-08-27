import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { InventoryReconciliationQueryDto } from './dto/inventory-reconciliation-query.dto';
import {
  InventoryBalancesService,
  InventoryReconciliationRow,
} from './inventory-balances.service';

@Roles(UserRole.ADMIN)
@Controller('admin/inventory-reconciliation')
export class InventoryReconciliationController {
  constructor(
    private readonly inventoryBalancesService: InventoryBalancesService,
  ) {}

  @Get()
  reconcile(
    @Query() query: InventoryReconciliationQueryDto,
  ): Promise<InventoryReconciliationRow[]> {
    return this.inventoryBalancesService.reconcileStore(query.storeId);
  }

  @Post(':storeId/repair')
  repair(
    @Param('storeId') storeId: string,
  ): Promise<InventoryReconciliationRow[]> {
    return this.inventoryBalancesService.runInTransaction((manager) =>
      this.inventoryBalancesService.repairStore(storeId, manager),
    );
  }
}
