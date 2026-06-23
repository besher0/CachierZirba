import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CreateInventoryDestructionDto } from './dto/create-inventory-destruction.dto';
import { ListInventoryDestructionsQueryDto } from './dto/list-inventory-destructions-query.dto';
import { InventoryDestruction } from './entities/inventory-destruction.entity';
import { InventoryDestructionsService } from './inventory-destructions.service';

@Roles(UserRole.ADMIN, UserRole.CASHIER)
@Controller('inventory-destructions')
export class InventoryDestructionsController {
  constructor(
    private readonly inventoryDestructionsService: InventoryDestructionsService,
  ) {}

  @Get()
  findAll(
    @Query() query: ListInventoryDestructionsQueryDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<InventoryDestruction[]> {
    return this.inventoryDestructionsService.findAll(query, authUser);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(
    @Body() dto: CreateInventoryDestructionDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<InventoryDestruction> {
    return this.inventoryDestructionsService.create(dto, authUser);
  }
}
