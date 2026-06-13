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

export class CreateEmployeeWithdrawalDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  clientWithdrawalId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  employeeClientId: string;

  @IsUUID()
  storeId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  withdrawalDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsDateString()
  syncedAt?: string;
}
