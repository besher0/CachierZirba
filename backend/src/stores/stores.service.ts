import { ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CreateStoreDto } from './dto/create-store.dto';
import { Store } from './entities/store.entity';

@Injectable()
export class StoresService implements OnModuleInit {
  constructor(
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaults();
  }

  async create(dto: CreateStoreDto): Promise<Store> {
    try {
      const store = this.storeRepository.create({
        ...dto,
        isActive: dto.isActive ?? true,
      });
      return await this.storeRepository.save(store);
    } catch (error: unknown) {
      if (this.isSqliteUniqueConstraintError(error)) {
        throw new ConflictException('Store code already exists.');
      }
      throw error;
    }
  }

  async findAll(): Promise<Store[]> {
    return this.storeRepository.find({
      order: {
        createdAt: 'ASC',
      },
    });
  }

  async findForUser(authUser: AuthUser): Promise<Store[]> {
    if (authUser.role === UserRole.ADMIN) {
      return this.findAll();
    }

    if (!authUser.storeId) {
      return [];
    }

    const store = await this.findById(authUser.storeId);
    return [store];
  }

  async findById(id: string): Promise<Store> {
    const store = await this.storeRepository.findOne({ where: { id } });
    if (!store) {
      throw new NotFoundException(`Store ${id} was not found.`);
    }
    return store;
  }

  private async seedDefaults(): Promise<void> {
    const defaults: Array<Pick<Store, 'id' | 'name' | 'code' | 'isActive'>> = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Zirba Main Branch',
        code: 'ZIRBA_MAIN',
        isActive: true,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Zirba Mall Branch',
        code: 'ZIRBA_MALL',
        isActive: true,
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Bashar Store',
        code: 'ZIRBA_BASHAR',
        isActive: true,
      },
    ];

    const existingStores = await this.storeRepository
      .createQueryBuilder('store')
      .where('store.code IN (:...codes)', { codes: defaults.map((entry) => entry.code) })
      .getMany();

    const existingCodes = new Set(existingStores.map((store) => store.code));
    const missingDefaults = defaults.filter((entry) => !existingCodes.has(entry.code));
    if (missingDefaults.length === 0) {
      return;
    }

    const stores = missingDefaults.map((entry) => this.storeRepository.create(entry));
    await this.storeRepository.save(stores);
  }

  private isSqliteUniqueConstraintError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const candidate = error as QueryFailedError & { message?: string };
    return candidate.message?.includes('UNIQUE constraint failed') ?? false;
  }
}
