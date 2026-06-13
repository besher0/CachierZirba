import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateInventoryAdjustmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  clientAdjustmentId: string;

  @IsUUID()
  storeId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  productClientId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  actualQuantity: number;

  @IsDateString()
  adjustedAt: string;

  @IsOptional()
  @IsDateString()
  syncedAt?: string;
}
