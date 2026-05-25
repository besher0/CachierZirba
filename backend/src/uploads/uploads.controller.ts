import { Body, Controller, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { CreateCloudinarySignatureDto } from './dto/create-cloudinary-signature.dto';
import { UploadsService } from './uploads.service';

@Roles(UserRole.ADMIN, UserRole.CASHIER)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('cloudinary-signature')
  createCloudinarySignature(@Body() dto: CreateCloudinarySignatureDto) {
    return this.uploadsService.createExpenseImageSignature(dto);
  }
}
