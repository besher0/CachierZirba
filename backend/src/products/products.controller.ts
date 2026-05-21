import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { ProductsService } from './products.service';

@Roles(UserRole.ADMIN, UserRole.CASHIER)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(): Promise<Product[]> {
    return this.productsService.findAll();
  }

  @Post()
  create(@Body() dto: CreateProductDto): Promise<Product> {
    return this.productsService.create(dto);
  }

  @Patch(':clientProductId')
  update(
    @Param('clientProductId') clientProductId: string,
    @Body() dto: UpdateProductDto,
  ): Promise<Product> {
    return this.productsService.update(clientProductId, dto);
  }

  @Delete(':clientProductId')
  remove(@Param('clientProductId') clientProductId: string): Promise<{ deleted: true }> {
    return this.productsService.remove(clientProductId);
  }
}
