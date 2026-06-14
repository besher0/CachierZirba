import { ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { isUniqueConstraintError } from '../database/is-unique-constraint-error';
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
      if (isUniqueConstraintError(error)) {
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
        name: 'محافظة',
        code: 'ZIRBA_MAIN',
        isActive: true,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'فرقان',
        code: 'ZIRBA_MALL',
        isActive: true,
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'اندلس',
        code: 'ZIRBA_BASHAR',
        isActive: true,
      },
    ];

    for (const entry of defaults) {
      const existing =
        (await this.storeRepository.findOne({
          where: [{ code: entry.code }, { id: entry.id }],
        })) ?? null;

      if (!existing) {
        const created = this.storeRepository.create(entry);
        await this.storeRepository.save(created);
        continue;
      }

      let changed = false;
      if (existing.name !== entry.name) {
        existing.name = entry.name;
        changed = true;
      }
      if (existing.code !== entry.code) {
        existing.code = entry.code;
        changed = true;
      }
      if (existing.isActive !== entry.isActive) {
        existing.isActive = entry.isActive;
        changed = true;
      }
      if (changed) {
        await this.storeRepository.save(existing);
      }
    }
  }

}
