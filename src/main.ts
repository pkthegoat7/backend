import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './prisma-exception.filter';

async function bootstrap() {
  // Cria a aplicação baseada no módulo principal
  const app = await NestFactory.create(AppModule);

  // 1. FILTROS GLOBAIS (Prisma)
  // Centraliza o tratamento de erros do banco de dados (P2002, P2025, etc)
  app.useGlobalFilters(new PrismaExceptionFilter());

  // 2. CONFIGURAÇÃO DE CORS
  const productionOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [];

  app.enableCors({
    origin: (origin, callback) => {
      const devOrigins = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ];

      const allowedOrigins = [...devOrigins, ...productionOrigins];

      const isAllowed =
        !origin ||
        allowedOrigins.includes(origin) ||
        /^https?:\/\/.*\.vercel\.app$/.test(origin) ||
        /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):(3000|5173)$/.test(origin);

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Origem não permitida pelo CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
    credentials: true,
  });

  // 3. DEFINIÇÃO DA PORTA E HOST
  // 3001 para não conflitar com o Next.js. '0.0.0.0' para aceitar conexões da rede.
  const PORT = process.env.PORT ?? 3001;
  await app.listen(PORT, '0.0.0.0');

  // 4. LOGS DE INICIALIZAÇÃO
  console.log(`\n🚀 JoluAI Backend inicializado com sucesso!`);
  console.log(`🏠 Acesso Local:   http://localhost:${PORT}`);
  console.log(`🌐 Acesso na Rede:  http://0.0.0.0:${PORT}`);
  console.log(`✅ Filtros do Prisma e CORS configurados.\n`);
}

bootstrap();