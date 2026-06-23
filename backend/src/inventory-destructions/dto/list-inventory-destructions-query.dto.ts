import { IsOptional, IsUUID } from 'class-validator';

export class ListInventoryDestructionsQueryDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;
}
