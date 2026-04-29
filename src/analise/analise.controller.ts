import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth/auth.guard';
import { AnaliseService } from './analise.service';

@Controller('analise')
export class AnaliseController {
  constructor(private readonly analiseService: AnaliseService) {}

  @Post('upload')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
    @Body('landmarks') landmarksJson?: string,
  ) {
    const userId = req.user.sub;
    const landmarks = landmarksJson ? JSON.parse(landmarksJson) : null;
    return this.analiseService.salvarAnalise(userId, file, landmarks);
  }
}