import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getLeads(page = 1, limit = 30) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          token: { select: { campanha: true, slug: true } },
          analise: { select: { id: true, emailEnviado: true, createdAt: true, resultado: true } },
        },
      }),
      this.prisma.lead.count(),
    ]);
    return { data, total, page, limit };
  }

  async getLead(id: string) {
    return this.prisma.lead.findUnique({
      where: { id },
      include: {
        token: true,
        analise: true,
      },
    });
  }

  async getTokens() {
    return this.prisma.campaignToken.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { leads: true } } },
    });
  }

  async criarToken(campanha: string, slug?: string) {
    const finalSlug = slug?.trim() || randomBytes(6).toString('hex');
    return this.prisma.campaignToken.create({
      data: { campanha, slug: finalSlug },
    });
  }

  async toggleToken(id: string, ativo: boolean) {
    return this.prisma.campaignToken.update({ where: { id }, data: { ativo } });
  }

  async getStats() {
    const [totalLeads, analisadas, emailsEnviados] = await Promise.all([
      this.prisma.lead.count(),
      this.prisma.leadAnalise.count(),
      this.prisma.leadAnalise.count({ where: { emailEnviado: true } }),
    ]);
    return { totalLeads, analisadas, emailsEnviados, pendentes: totalLeads - analisadas };
  }
}
