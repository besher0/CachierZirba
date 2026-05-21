import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async findAll(): Promise<Product[]> {
    return this.productRepository.find({
      order: {
        name: 'ASC',
        createdAt: 'ASC',
      },
    });
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const existing = await this.productRepository.findOne({
      where: { clientProductId: dto.clientProductId },
    });
    if (existing) {
      return existing;
    }

    try {
      const record = this.productRepository.create({
        ...dto,
        syncedAt: dto.syncedAt ? new Date(dto.syncedAt) : new Date(),
      });

      const saved = await this.productRepository.save(record);
      return this.findById(saved.id);
    } catch (error: unknown) {
      if (this.isSqliteUniqueConstraintError(error)) {
        return this.findByClientProductId(dto.clientProductId);
      }
      throw error;
    }
  }

  async update(clientProductId: string, dto: UpdateProductDto): Promise<Product> {
    const record = await this.findByClientProductId(clientProductId);

    if (dto.name !== undefined) {
      record.name = dto.name;
    }

    if (dto.unitType !== undefined) {
      record.unitType = dto.unitType;
    }

    if (dto.price !== undefined) {
      record.price = dto.price;
    }

    if (dto.costPrice !== undefined) {
      record.costPrice = dto.costPrice;
    }

    record.syncedAt = dto.syncedAt ? new Date(dto.syncedAt) : new Date();

    await this.productRepository.save(record);
    return this.findById(record.id);
  }

  async remove(clientProductId: string): Promise<{ deleted: true }> {
    const record = await this.productRepository.findOne({
      where: { clientProductId },
    });

    if (!record) {
      return { deleted: true };
    }

    await this.productRepository.delete({ id: record.id });
    return { deleted: true };
  }

  private async findById(id: string): Promise<Product> {
    const record = await this.productRepository.findOne({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException(`Product ${id} was not found.`);
    }

    return record;
  }

  private async findByClientProductId(clientProductId: string): Promise<Product> {
    const record = await this.productRepository.findOne({
      where: { clientProductId },
    });

    if (!record) {
      throw new NotFoundException(
        `Product with clientProductId ${clientProductId} was not found.`,
      );
    }

    return record;
  }

  private isSqliteUniqueConstraintError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const candidate = error as QueryFailedError & { message?: string };
    return candidate.message?.includes('UNIQUE constraint failed') ?? false;
  }
}
