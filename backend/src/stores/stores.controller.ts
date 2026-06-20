import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { AdjustCashCarryDto } from './dto/adjust-cash-carry.dto';
import { CreateStoreDto } from './dto/create-store.dto';
import { Store } from './entities/store.entity';
import { StoresService } from './stores.service';

@Roles(UserRole.ADMIN, UserRole.CASHIER)
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateStoreDto): Promise<Store> {
    return this.storesService.create(dto);
  }

  @Get()
  findAll(@CurrentUser() authUser: AuthUser): Promise<Store[]> {
    return this.storesService.findForUser(authUser);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() authUser: AuthUser,
  ): Promise<Store> {
    if (authUser.role === UserRole.CASHIER && authUser.storeId !== id) {
      throw new ForbiddenException(
        'Cashier can only access the assigned store.',
      );
    }

    return this.storesService.findById(id);
  }

  @Patch(':id/cash-carry/add')
  addCashCarry(
    @Param('id') id: string,
    @Body() dto: AdjustCashCarryDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<Store> {
    return this.storesService.addCashCarry(id, dto.amount, authUser);
  }
}
