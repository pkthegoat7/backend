import {
  Controller, Post, Get, Param, Body,
  UseInterceptors, UploadedFile, Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LeadsService } from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get('validate-token')
  async validateToken(@Query('slug') slug: string) {
    const token = await this.leadsService.validarToken(slug);
    if (!token) return { valid: false };
    return { valid: true, campanha: token.campanha };
  }

  @Post()
  async criarLead(
    @Body() body: {
      nome: string;
      email: string;
      telefone: string;
      desejaMelhorar: string;
      tokenSlug: string;
    },
  ) {
    return this.leadsService.criarLead(body);
  }

  @Post(':id/analise')
  @UseInterceptors(FileInterceptor('image'))
  async analisarLead(
    @Param('id') leadId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('landmarks') landmarksJson?: string,
  ) {
    const landmarks = landmarksJson ? JSON.parse(landmarksJson) : null;
    return this.leadsService.analisarLead(leadId, file, landmarks);
  }
}
