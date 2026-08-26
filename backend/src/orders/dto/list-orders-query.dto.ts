import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { MAX_LIST_LIMIT } from '../../common/list-pagination';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { OrderStatus } from '../enums/order-status.enum';

export class ListOrdersQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIST_LIMIT)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
