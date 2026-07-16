import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  clientExpenseId: string;

  @IsUUID()
  storeId: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  expenseDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cycleStartClosureId?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  category: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  description: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsDateString()
  syncedAt?: string;
}
