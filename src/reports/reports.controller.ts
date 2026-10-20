import { Controller, Get, Query } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { ManagerOnly } from '../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

class ReportQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

@ManagerOnly()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** Ringkasan penjualan. Parameter from/to dalam format YYYY-MM-DD (default: hari ini). */
  @Get('summary')
  summary(@Query() query: ReportQueryDto) {
    return this.reports.summary(query.from, query.to);
  }
}
