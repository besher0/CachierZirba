import { IsUUID } from 'class-validator';

export class InventoryReconciliationQueryDto {
  @IsUUID()
  storeId: string;
}
