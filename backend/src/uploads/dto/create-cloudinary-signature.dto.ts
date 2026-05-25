import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCloudinarySignatureDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  folder?: string;
}
