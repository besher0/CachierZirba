import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let repository: jest.Mocked<Partial<Repository<Product>>>;

  const product = {
    id: 'server-id',
    clientProductId: 'product-1',
    name: 'Cake',
    unitType: 'PIECE',
    price: 20,
    costPrice: 10,
    excludeFromPurchaseInvoice: false,
    syncedAt: new Date('2026-06-14T20:00:00.000Z'),
    createdAt: new Date('2026-06-14T20:00:00.000Z'),
    updatedAt: new Date('2026-06-14T20:00:00.000Z'),
  } as Product;

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(ProductsService);
  });

  it('creates a product that can be excluded from purchase invoices', async () => {
    const created = {
      ...product,
      excludeFromPurchaseInvoice: true,
    } as Product;
    repository.findOne?.mockResolvedValueOnce(null).mockResolvedValueOnce(created);
    repository.create?.mockReturnValue(created);
    repository.save?.mockResolvedValue(created);

    await expect(
      service.create({
        clientProductId: 'product-1',
        name: 'Cake',
        unitType: 'PIECE',
        price: 20,
        costPrice: 10,
        excludeFromPurchaseInvoice: true,
        syncedAt: '2026-06-14T20:00:00.000Z',
      }),
    ).resolves.toBe(created);

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ excludeFromPurchaseInvoice: true }),
    );
  });

  it('updates the purchase invoice exclusion flag', async () => {
    const existing = { ...product } as Product;
    const updated = { ...product, excludeFromPurchaseInvoice: true } as Product;
    repository.findOne
      ?.mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(updated);
    repository.save?.mockResolvedValue(updated);

    await expect(
      service.update('product-1', {
        excludeFromPurchaseInvoice: true,
        syncedAt: '2026-06-14T20:00:00.000Z',
      }),
    ).resolves.toBe(updated);

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ excludeFromPurchaseInvoice: true }),
    );
  });
});
