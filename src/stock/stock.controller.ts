import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { ManagerOnly } from '../common/decorators/roles.decorator';
import { AdjustStockDto, StockQueryDto } from './stock.dto';
import { StockService } from './stock.service';

@ManagerOnly()
@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get('movements')
  findMovements(@Query() query: StockQueryDto) {
    return this.stock.findMovements(query);
  }

  @Post('adjust')
  adjust(@CurrentUser() user: AuthUser, @Body() dto: AdjustStockDto) {
    return this.stock.adjust(user, dto);
  }
}
