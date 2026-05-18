import { IsOptional, IsString, IsUUID } from 'class-validator';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';

export class ListPurchasesQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsString()
  product?: string;
}
