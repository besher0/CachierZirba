import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { ExpenseCategory } from '../enums/expense-category.enum';

export class ListExpensesQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsOptional()
  @IsString()
  description?: string;
}
