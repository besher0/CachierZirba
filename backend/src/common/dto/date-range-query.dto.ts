import { IsOptional, IsString, Matches } from 'class-validator';

const DATE_OR_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}(?:[Tt ].+)?$/;

export class DateRangeQueryDto {
  @IsOptional()
  @IsString()
  @Matches(DATE_OR_DATETIME_REGEX, {
    message: 'from must be YYYY-MM-DD or ISO date-time.',
  })
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_OR_DATETIME_REGEX, {
    message: 'to must be YYYY-MM-DD or ISO date-time.',
  })
  to?: string;
}
