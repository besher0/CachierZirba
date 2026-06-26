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

  async updatePassword(user: User, password: string): Promise<void> {
    user.passwordHash = await hash(password, 10);
    await this.userRepository.save(user);
  }

  private async seedDefaults(): Promise<void> {
    const stores = await this.storesService.findAll();
    const mainStore = stores.find((store) => store.code === 'ZIRBA_MAIN') ?? null;
    const mallStore = stores.find((store) => store.code === 'ZIRBA_MALL') ?? null;
    const andalusStore = stores.find((store) => store.code === 'ZIRBA_BASHAR') ?? null;

    await this.ensureAccount({
      username: 'مها',
      password: 'abcd',
      displayName: 'مها',
      role: UserRole.ADMIN,
      storeId: null,
      legacyUsernames: ['admin'],
    });

    await this.ensureAccount({
      username: 'محافظة',
      password: '0000',
      displayName: 'كاشير محافظة',
      role: UserRole.CASHIER,
      storeId: mainStore?.id ?? null,
      legacyUsernames: ['cashier.main'],
    });

    await this.ensureAccount({
      username: 'فرقان',
      password: '1111',
      displayName: 'كاشير فرقان',
      role: UserRole.CASHIER,
      storeId: mallStore?.id ?? null,
      legacyUsernames: ['cashier.mall'],
    });

    await this.ensureAccount({
      username: 'اندلس',
      password: '5555',
      displayName: 'كاشير اندلس',
      role: UserRole.CASHIER,
      storeId: andalusStore?.id ?? null,
      legacyUsernames: ['بشر'],
    });
  }

  private normalizeUsername(value: string): string {
    return value.trim().toLowerCase();
  }

  private async ensureAccount({
    username,
    password,
    displayName,
    role,
    storeId,
    legacyUsernames = [],
  }: {
    username: string;
    password: string;
    displayName: string;
    role: UserRole;
    storeId: string | null;
    legacyUsernames?: string[];
  }): Promise<void> {
    const normalizedUsername = this.normalizeUsername(username);
    const normalizedLegacyUsernames = legacyUsernames.map((entry) =>
      this.normalizeUsername(entry),
    );

    const existingPrimary = await this.userRepository.findOne({
      where: { username: normalizedUsername },
    });

    const legacyUsers = normalizedLegacyUsernames.length
      ? await this.userRepository.find({
          where: normalizedLegacyUsernames.map((entry) => ({ username: entry })),
        })
      : [];

    const account = existingPrimary ?? legacyUsers[0] ?? this.userRepository.create();
    const isNewAccount = !account.id;
    account.username = normalizedUsername;
    if (isNewAccount) {
      account.passwordHash = await hash(password, 10);
    }
    account.role = role;
    account.displayName = displayName;
    account.storeId = role === UserRole.ADMIN ? null : storeId;
    account.isActive = true;

    const savedAccount = await this.userRepository.save(account);

    const legacyDuplicates = legacyUsers.filter((entry) => entry.id !== savedAccount.id);
    for (const duplicate of legacyDuplicates) {
      if (!duplicate.isActive) {
        continue;
      }

      duplicate.isActive = false;
      await this.userRepository.save(duplicate);
    }
  }
}
