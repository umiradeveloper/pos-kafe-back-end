import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { ManagerOnly } from '../common/decorators/roles.decorator';
import { CreateOrderDto, OrderQueryDto, VoidOrderDto } from './orders.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: OrderQueryDto) {
    return this.orders.findAll(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.orders.findOne(user, id);
  }

  @ManagerOnly()
  @Post(':id/void')
  @HttpCode(200)
  void(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: VoidOrderDto) {
    return this.orders.void(user, id, dto);
  }
}
