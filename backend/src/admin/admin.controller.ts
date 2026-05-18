import { Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { DateRangeQueryDto } from '../common/dto/date-range-query.dto';
import { DailySettlement } from '../daily-settlements/entities/daily-settlement.entity';
import { ListOrdersQueryDto } from '../orders/dto/list-orders-query.dto';
import { Order } from '../orders/entities/order.entity';
import {
  AdminDashboardResponse,
  AdminService,
  StoreSummaryResponse,
} from './admin.service';

@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  getDashboard(@Query() query: DateRangeQueryDto): Promise<AdminDashboardResponse> {
    return this.adminService.getDashboard(query);
  }

  @Get('stores/:storeId/summary')
  getStoreSummary(
    @Param('storeId') storeId: string,
    @Query() query: DateRangeQueryDto,
  ): Promise<StoreSummaryResponse> {
    return this.adminService.getStoreSummary(storeId, query);
  }

  @Get('stores/:storeId/orders')
  getStoreOrders(
    @Param('storeId') storeId: string,
    @Query() query: ListOrdersQueryDto,
  ): Promise<Order[]> {
    return this.adminService.listStoreOrders(storeId, query);
  }

  @Get('stores/:storeId/daily-settlements')
  getStoreDailySettlements(
    @Param('storeId') storeId: string,
    @Query() query: DateRangeQueryDto,
  ): Promise<DailySettlement[]> {
    return this.adminService.listStoreDailySettlements(storeId, query);
  }
}