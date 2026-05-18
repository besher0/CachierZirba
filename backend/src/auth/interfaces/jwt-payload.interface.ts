import { UserRole } from '../enums/user-role.enum';

export interface JwtPayload {
  sub: string;
  username: string;
  role: UserRole;
  displayName: string;
  storeId?: string;
}
