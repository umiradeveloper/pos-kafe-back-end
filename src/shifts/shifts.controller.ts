import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { ManagerOnly } from '../common/decorators/roles.decorator';
import { CashMovementDto, CloseShiftDto, OpenShiftDto, ShiftQueryDto } from './shifts.dto';
import { ShiftsService } from './shifts.service';

@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  @Get('current')
  current(@CurrentUser() user: AuthUser) {
    return this.shifts.current(user);
  }

  @Post('open')
  open(@CurrentUser() user: AuthUser, @Body() dto: OpenShiftDto) {
    return this.shifts.open(user, dto);
  }

  @Post('cash')
  addCashMovement(@CurrentUser() user: AuthUser, @Body() dto: CashMovementDto) {
    return this.shifts.addCashMovement(user, dto);
  }

  @Post('close')
  @HttpCode(200)
  close(@CurrentUser() user: AuthUser, @Body() dto: CloseShiftDto) {
    return this.shifts.close(user, dto);
  }

  @ManagerOnly()
  @Get()
  findAll(@Query() query: ShiftQueryDto) {
    return this.shifts.findAll(query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.shifts.findOne(user, id);
  }
}
