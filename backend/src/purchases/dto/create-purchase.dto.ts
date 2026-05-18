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

export class CreatePurchaseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  clientPurchaseId: string;

  @IsUUID()
  storeId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  productName: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  quantity: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalCost: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  purchaseDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsDateString()
  syncedAt?: string;
}
