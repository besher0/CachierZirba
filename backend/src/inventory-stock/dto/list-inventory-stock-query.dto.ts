import { IsOptional, IsUUID } from 'class-validator';

export class ListInventoryStockQueryDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;
}
