import { Module } from '@nestjs/common';
import { AnaliseController } from './analise.controller';
import { AnaliseService } from './analise.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [AnaliseController],
  providers: [AnaliseService, PrismaService],
})
export class AnaliseModule {}