import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AnaliseModule } from './analise/analise.module';
import { LeadsModule } from './leads/leads.module';
import { AdminModule } from './admin/admin.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    AnaliseModule,
    LeadsModule,
    AdminModule,
  ],
  controllers: [],
  providers: [PrismaService],
})
export class AppModule {}
