import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; 
import { AuthModule } from './auth/auth.module';
import { AnaliseModule } from './analise/analise.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    // O ConfigModule DEVE ser o primeiro da lista de imports
    ConfigModule.forRoot({ 
      isGlobal: true 
    }), 
    AuthModule, 
    AnaliseModule
  ],
  controllers: [],
  providers: [PrismaService],
})
export class AppModule {}