import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [ShiftsModule, SettingsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
