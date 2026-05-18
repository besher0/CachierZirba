import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { OrderStatus } from '../enums/order-status.enum';

export class ListOrdersQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}