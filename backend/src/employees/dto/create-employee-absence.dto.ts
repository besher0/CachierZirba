import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateEmployeeAbsenceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  clientAbsenceId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  employeeClientId: string;

  @IsUUID()
  storeId: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  absenceDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsDateString()
  syncedAt?: string;
}
