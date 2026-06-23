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

export class CreateInventoryDestructionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  clientDestructionId: string;

  @IsUUID()
  storeId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  productClientId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsDateString()
  destroyedAt: string;

  @IsOptional()
  @IsDateString()
  syncedAt?: string;
}
