import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { JWT_EXPIRES_IN } from './constants/auth.constants';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserRole } from './enums/user-role.enum';
import { AuthUser } from './interfaces/auth-user.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { LoginDto } from './dto/login.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ accessToken: string; user: AuthUser; expiresIn: string }> {
    const username = dto.username.trim().toLowerCase();
    const user = await this.usersService.findByUsername(username);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid username or password.');
    }

    const isValid = await compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid username or password.');
    }

    const authUser = this.usersService.toAuthUser(user);
    const payload: JwtPayload = {
      sub: authUser.id,
      username: authUser.username,
      role: authUser.role,
      displayName: authUser.displayName,
      storeId: authUser.storeId ?? undefined,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: authUser,
      expiresIn: JWT_EXPIRES_IN,
    };
  }

  async changePassword(dto: ChangePasswordDto): Promise<{ message: string }> {
    const username = dto.username.trim().toLowerCase();
    const user = await this.usersService.findByUsername(username);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid username or password.');
    }

    const isValid = await compare(dto.oldPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid username or password.');
    }

    await this.usersService.updatePassword(user, dto.newPassword);

    return { message: 'Password updated successfully.' };
  }

  async me(authUser: AuthUser): Promise<AuthUser> {
    const user = await this.usersService.findById(authUser.id);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is not active.');
    }

    return this.usersService.toAuthUser(user);
  }

  isAdmin(authUser: AuthUser): boolean {
    return authUser.role === UserRole.ADMIN;
  }
}
