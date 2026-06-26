import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(70)
  username: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  oldPassword: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  newPassword: string;
}
