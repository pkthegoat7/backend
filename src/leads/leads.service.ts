import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AnaliseService } from '../analise/analise.service';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as nodemailer from 'nodemailer';

type Landmark = { x: number; y: number; z: number };

type Resultado = {
  tipoPele: string;
  nivelOleosidade: string;
  nivelAcne: string;
  nivelSensibilidade: string;
  observacoes?: string;
  recomendacoes: { nome: string; motivo: string; modoDeUso: string }[];
};

@Injectable()
export class LeadsService {
  private supabase: SupabaseClient;

  constructor(
    private prisma: PrismaService,
    private analiseService: AnaliseService,
    private configService: ConfigService,
  ) {
    const url = this.configService.get<string>('SUPABASE_URL')!;
    const key = this.configService.get<string>('SUPABASE_KEY')!;
    this.supabase = createClient(url, key);
  }

  async validarToken(slug: string) {
    const token = await this.prisma.campaignToken.findUnique({ where: { slug } });
    if (!token || !token.ativo) return null;
    return token;
  }

  async criarLead(dto: {
    nome: string;
    email: string;
    telefone: string;
    desejaMelhorar: string;
    tokenSlug: string;
  }) {
    const token = await this.validarToken(dto.tokenSlug);
    if (!token) throw new BadRequestException('Link inválido ou expirado.');

    const lead = await this.prisma.lead.create({
      data: {
        nome: dto.nome,
        email: dto.email,
        telefone: dto.telefone,
        desejaMelhorar: dto.desejaMelhorar,
        tokenId: token.id,
      },
    });

    return { id: lead.id, nome: lead.nome };
  }

  async analisarLead(
    leadId: string,
    file: Express.Multer.File,
    landmarks: Landmark[] | null,
  ) {
    if (!file) throw new BadRequestException('Nenhuma imagem foi enviada.');

    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead não encontrado.');

    const existing = await this.prisma.leadAnalise.findUnique({ where: { leadId } });
    if (existing) return { success: true };

    // Upload to Supabase
    const filePath = `leads/${Date.now()}-${randomBytes(4).toString('hex')}.jpg`;
    const { error: uploadError } = await this.supabase.storage
      .from('fotos-analise')
      .upload(filePath, file.buffer, { contentType: 'image/jpeg', upsert: true });

    if (uploadError) throw new Error(`Upload falhou: ${uploadError.message}`);

    const { data: { publicUrl } } = this.supabase.storage
      .from('fotos-analise')
      .getPublicUrl(filePath);

    const resultado = await this.analiseService.analisarImagem(file.buffer, landmarks) as Resultado;

    const registro = await this.prisma.leadAnalise.create({
      data: { leadId, imageUrl: publicUrl, resultado },
    });

    // Fire-and-forget: envia o email sem bloquear a resposta
    this.enviarEmailProtocolo(lead.email, lead.nome, resultado, registro.id)
      .catch((err) => console.error('[Email] Falha ao enviar protocolo:', err));

    return { success: true };
  }

  private async enviarEmailProtocolo(
    email: string,
    nome: string,
    resultado: Resultado,
    analiseId: string,
  ) {
    const smtpHost = this.configService.get<string>('SMTP_HOST');

    if (!smtpHost) {
      console.log(`[Email] SMTP não configurado — protocolo para ${email} (${nome})`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(this.configService.get<string>('SMTP_PORT') ?? '587'),
      secure: this.configService.get<string>('SMTP_PORT') === '465',
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });

    const produtosHtml = resultado.recomendacoes
      .map(
        (p, i) => `
        <div style="margin-bottom:16px;padding:16px;background:#fdf8fb;border-left:3px solid #b96f8d;border-radius:8px;">
          <p style="margin:0 0 6px;font-weight:700;color:#4a2435;">${i + 1}. ${p.nome}</p>
          <p style="margin:0 0 4px;color:#7a5060;font-size:14px;">${p.motivo}</p>
          <p style="margin:0;color:#9a7282;font-size:13px;"><strong>Modo de uso:</strong> ${p.modoDeUso}</p>
        </div>`,
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;padding:0;background:#f7f0f3;font-family:Inter,Arial,sans-serif;">
        <div style="max-width:580px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(74,36,53,.10);">

          <!-- Header -->
          <div style="background:linear-gradient(135deg,#4a2435,#b96f8d);padding:32px 32px 24px;text-align:center;">
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:rgba(255,255,255,.6);">Patrícia Elias</p>
            <h1 style="margin:0;font-size:26px;font-weight:300;color:#fff;letter-spacing:-0.5px;">Seu Protocolo de Pele</h1>
          </div>

          <!-- Body -->
          <div style="padding:32px;">
            <p style="margin:0 0 20px;font-size:16px;color:#4a2435;">Olá, <strong>${nome}</strong>!</p>
            <p style="margin:0 0 24px;font-size:14px;color:#7a5060;line-height:1.6;">
              Sua análise facial foi concluída. Abaixo está seu diagnóstico completo e o protocolo de cuidados personalizado para você.
            </p>

            <!-- Diagnóstico -->
            <div style="background:#f7f0f3;border-radius:12px;padding:20px;margin-bottom:24px;">
              <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#b8a0ac;">Diagnóstico</p>
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px 0;font-size:13px;color:#9a7282;width:140px;">Tipo de Pele</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#4a2435;">${resultado.tipoPele}</td></tr>
                <tr><td style="padding:6px 0;font-size:13px;color:#9a7282;">Oleosidade</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#4a2435;">${resultado.nivelOleosidade}</td></tr>
                <tr><td style="padding:6px 0;font-size:13px;color:#9a7282;">Acne</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#4a2435;">${resultado.nivelAcne}</td></tr>
                <tr><td style="padding:6px 0;font-size:13px;color:#9a7282;">Sensibilidade</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#4a2435;">${resultado.nivelSensibilidade}</td></tr>
              </table>
              ${resultado.observacoes && !resultado.observacoes.includes('fallback')
                ? `<p style="margin:12px 0 0;font-size:13px;font-style:italic;color:#9a7282;border-left:2px solid #c07898;padding-left:12px;">"${resultado.observacoes}"</p>`
                : ''}
            </div>

            <!-- Produtos -->
            <p style="margin:0 0 14px;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#b8a0ac;">Protocolo Recomendado</p>
            ${produtosHtml}

            <p style="margin:24px 0 0;font-size:13px;color:#9a7282;line-height:1.6;">
              Em caso de dúvidas, entre em contato com Patrícia Elias diretamente. Estamos aqui para ajudar você a alcançar a pele que merece.
            </p>
          </div>

          <!-- Footer -->
          <div style="padding:20px 32px;background:#f7f0f3;text-align:center;border-top:1px solid #e8d0db;">
            <p style="margin:0;font-size:11px;color:#b8a0ac;">© ${new Date().getFullYear()} Patrícia Elias · Skin Intelligence</p>
          </div>
        </div>
      </body>
      </html>`;

    await transporter.sendMail({
      from: `"Patrícia Elias Skin" <${this.configService.get<string>('SMTP_FROM') ?? 'noreply@patriciaeliasskin.com'}>`,
      to: email,
      subject: `${nome}, seu protocolo personalizado de pele está aqui 💌`,
      html,
    });

    // Marca o email como enviado no banco
    await this.prisma.leadAnalise.update({
      where: { id: analiseId },
      data: { emailEnviado: true },
    });

    console.log(`[Email] Protocolo enviado para ${email}`);
  }
}
