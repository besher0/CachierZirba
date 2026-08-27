import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';

const DATE_OR_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}(?:[Tt ].+)?$/;

export class ListInventoryStockQueryDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_OR_DATETIME_REGEX, {
    message: 'cycleStartedAt must be YYYY-MM-DD or ISO date-time.',
  })
  cycleStartedAt?: string;
}
