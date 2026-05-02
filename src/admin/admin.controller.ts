import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from '../auth/auth/auth.guard';

@Controller('admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('leads')
  getLeads(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getLeads(Number(page ?? 1), Number(limit ?? 30));
  }

  @Get('leads/:id')
  getLead(@Param('id') id: string) {
    return this.adminService.getLead(id);
  }

  @Get('tokens')
  getTokens() {
    return this.adminService.getTokens();
  }

  @Post('tokens')
  criarToken(@Body() body: { campanha: string; slug?: string }) {
    return this.adminService.criarToken(body.campanha, body.slug);
  }

  @Patch('tokens/:id')
  toggleToken(@Param('id') id: string, @Body() body: { ativo: boolean }) {
    return this.adminService.toggleToken(id, body.ativo);
  }
}
