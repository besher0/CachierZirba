import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CreateDailySettlementDto } from './dto/create-daily-settlement.dto';
import { ListDailySettlementsQueryDto } from './dto/list-daily-settlements-query.dto';
import { DailySettlement } from './entities/daily-settlement.entity';
import { DailySettlementsService } from './daily-settlements.service';

@Roles(UserRole.ADMIN, UserRole.CASHIER)
@Controller('daily-settlements')
export class DailySettlementsController {
  constructor(private readonly dailySettlementsService: DailySettlementsService) {}

  @Post()
  createOrUpdate(
    @Body() dto: CreateDailySettlementDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<DailySettlement> {
    return this.dailySettlementsService.createOrUpdate(dto, authUser);
  }

  @Get()
  findAll(
    @Query() query: ListDailySettlementsQueryDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<DailySettlement[]> {
    return this.dailySettlementsService.findAll(query, authUser);
  }
}