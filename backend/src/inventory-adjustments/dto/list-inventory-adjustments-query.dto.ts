import { IsOptional, IsUUID } from 'class-validator';

export class ListInventoryAdjustmentsQueryDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;
}
