import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import type { AuthUser } from './interfaces/auth-user.interface';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto): Promise<{ accessToken: string; user: AuthUser; expiresIn: string }> {
    return this.authService.login(dto);
  }

  @Public()
  @HttpCode(200)
  @Post('change-password')
  changePassword(@Body() dto: ChangePasswordDto): Promise<{ message: string }> {
    return this.authService.changePassword(dto);
  }

  @Get('me')
  me(@CurrentUser() authUser: AuthUser): Promise<AuthUser> {
    return this.authService.me(authUser);
  }
}
