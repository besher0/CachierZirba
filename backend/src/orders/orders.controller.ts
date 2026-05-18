import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { Order } from './entities/order.entity';
import { OrdersService } from './orders.service';

@Roles(UserRole.ADMIN, UserRole.CASHIER)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentUser() authUser: AuthUser): Promise<Order> {
    return this.ordersService.create(dto, authUser);
  }

  @Get()
  findAll(@Query() query: ListOrdersQueryDto, @CurrentUser() authUser: AuthUser): Promise<Order[]> {
    return this.ordersService.findAll(query, authUser);
  }
}