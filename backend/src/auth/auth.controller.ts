import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
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

  @Get('me')
  me(@CurrentUser() authUser: AuthUser): Promise<AuthUser> {
    return this.authService.me(authUser);
  }
}
