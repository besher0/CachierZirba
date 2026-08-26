import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { MAX_LIST_LIMIT } from '../../common/list-pagination';

export class ListAdminDateRangeQueryDto extends DateRangeQueryDto {
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
