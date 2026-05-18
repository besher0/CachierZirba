import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from 'bcryptjs';
import { Repository } from 'typeorm';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { StoresService } from '../stores/stores.service';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly storesService: StoresService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaults();
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: {
        username: username.toLowerCase(),
      },
      relations: {
        store: true,
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: { store: true },
    });
  }

  toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
      storeId: user.storeId,
    };
  }

  private async seedDefaults(): Promise<void> {
    const stores = await this.storesService.findAll();
    const mainStore =
      stores.find((store) => store.code === 'ZIRBA_MAIN') ?? null;
    const mallStore =
      stores.find((store) => store.code === 'ZIRBA_MALL') ?? null;
    const basharStore =
      stores.find((store) => store.code === 'ZIRBA_BASHAR') ?? null;

    const count = await this.userRepository.count();
    if (count === 0) {
      const passwordHashAdmin = await hash('Admin@123', 10);
      const passwordHashCashier = await hash('Cashier@123', 10);

      const users = this.userRepository.create([
        {
          username: 'admin',
          passwordHash: passwordHashAdmin,
          role: UserRole.ADMIN,
          displayName: 'مدير النظام',
          storeId: null,
          isActive: true,
        },
        {
          username: 'cashier.main',
          passwordHash: passwordHashCashier,
          role: UserRole.CASHIER,
          displayName: 'كاشير الفرع الرئيسي',
          storeId: mainStore?.id ?? null,
          isActive: true,
        },
        {
          username: 'cashier.mall',
          passwordHash: passwordHashCashier,
          role: UserRole.CASHIER,
          displayName: 'كاشير فرع المول',
          storeId: mallStore?.id ?? null,
          isActive: true,
        },
      ]);

      await this.userRepository.save(users);
    }

    await this.ensureCashierAccount({
      username: 'بشر',
      password: '0000',
      displayName: 'كاشير محل بشر',
      storeId: basharStore?.id ?? null,
    });
  }

  private async ensureCashierAccount({
    username,
    password,
    displayName,
    storeId,
  }: {
    username: string;
    password: string;
    displayName: string;
    storeId: string | null;
  }): Promise<void> {
    const existingUser = await this.userRepository.findOne({
      where: { username },
    });
    if (existingUser) {
      return;
    }

    const passwordHash = await hash(password, 10);
    const user = this.userRepository.create({
      username,
      passwordHash,
      role: UserRole.CASHIER,
      displayName,
      storeId,
      isActive: true,
    });

    await this.userRepository.save(user);
  }
}
