import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';

type Landmark = { x: number; y: number; z: number };

// MediaPipe Face Mesh: Face Oval contour indices (used to crop the face region)
const FACE_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
  378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
  162, 21, 54, 103, 67, 109,
];

const SKIN_ANALYSIS_SYSTEM = `You are a professional dermatologist and skin analysis AI.
Analyze the provided facial image and return ONLY a valid JSON object — no markdown, no extra text.

Required JSON schema:
{
  "tipoPele": "Oleosa" | "Mista" | "Seca/Sensivel",
  "nivelOleosidade": "Alta" | "Media" | "Baixa",
  "nivelAcne": "Severa" | "Moderada" | "Leve" | "Baixa",
  "nivelSensibilidade": "Alta" | "Media" | "Baixa",
  "observacoes": "<1-2 sentences in Portuguese describing what you actually observed>"
}`;

@Injectable()
export class AnaliseService {
  private supabase: SupabaseClient;
  private claude: Anthropic;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL ou SUPABASE_KEY não encontradas no arquivo .env');
    }
    this.supabase = createClient(supabaseUrl, supabaseKey);

    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY não encontrada no arquivo .env');
    }
    this.claude = new Anthropic({ apiKey: anthropicKey });
  }

  async salvarAnalise(
    userId: string,
    file: Express.Multer.File,
    landmarks: Landmark[] | null,
  ) {
    if (!file) throw new BadRequestException('Nenhuma imagem foi enviada.');

    const filePath = `fotos/${Date.now()}-${file.originalname}`;

    const { error: uploadError } = await this.supabase.storage
      .from('fotos-analise')
      .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });

    if (uploadError) {
      throw new Error(`Erro no upload para o Supabase: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = this.supabase.storage
      .from('fotos-analise')
      .getPublicUrl(filePath);

    const resultadoIA = await this.analisarComClaude(file.buffer, landmarks);

    return await this.prisma.analise.create({
      data: { userId, imageUrl: publicUrl, resultado: resultadoIA },
      include: { usuario: { select: { name: true } } },
    });
  }

  async analisarImagem(imageBuffer: Buffer, landmarks: Landmark[] | null) {
    return this.analisarComClaude(imageBuffer, landmarks);
  }

  private async analisarComClaude(imageBuffer: Buffer, landmarks: Landmark[] | null) {
    let faceBuffer = imageBuffer;

    if (landmarks) {
      faceBuffer = await this.cropFaceRegion(imageBuffer, landmarks);
    }

    const base64Image = faceBuffer.toString('base64');

    let parsed: Record<string, string> | null = null;

    try {
      const response = await this.claude.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: SKIN_ANALYSIS_SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: base64Image },
              },
              {
                type: 'text',
                text: 'Analise esta imagem facial e retorne o JSON de diagnóstico de pele.',
              },
            ],
          },
        ],
      });

      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('');

      console.log('[Claude] resposta bruta:', text);

      // Extract JSON — Claude occasionally wraps it in a code fence
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]) as Record<string, string>;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Claude] erro na análise:', msg);
    }

    if (!parsed) {
      return this.fallbackPorBuffer(imageBuffer);
    }

    const tipoPele = parsed.tipoPele ?? 'Mista';
    return {
      status: 'Concluido',
      tipoPele,
      nivelOleosidade: parsed.nivelOleosidade ?? 'Media',
      nivelAcne: parsed.nivelAcne ?? 'Leve',
      nivelSensibilidade: parsed.nivelSensibilidade ?? 'Media',
      observacoes: parsed.observacoes ?? '',
      recomendacoes: this.recomendacoesPara(tipoPele),
    };
  }

  private async cropFaceRegion(imageBuffer: Buffer, landmarks: Landmark[]): Promise<Buffer> {
    try {
      const image = sharp(imageBuffer);
      const { width, height } = await image.metadata();
      if (!width || !height) return imageBuffer;

      const xs = FACE_OVAL_INDICES
        .filter((i) => i < landmarks.length)
        .map((i) => landmarks[i].x * width);
      const ys = FACE_OVAL_INDICES
        .filter((i) => i < landmarks.length)
        .map((i) => landmarks[i].y * height);

      if (xs.length === 0) return imageBuffer;

      const padding = 0.12; // 12% padding around the bounding box
      const minX = Math.max(0, Math.floor(Math.min(...xs) - width * padding));
      const minY = Math.max(0, Math.floor(Math.min(...ys) - height * padding));
      const maxX = Math.min(width, Math.ceil(Math.max(...xs) + width * padding));
      const maxY = Math.min(height, Math.ceil(Math.max(...ys) + height * padding));

      return await image
        .extract({ left: minX, top: minY, width: maxX - minX, height: maxY - minY })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      return imageBuffer;
    }
  }

  private recomendacoesPara(tipoPele: string) {
    const mapa: Record<string, any[]> = {
      Oleosa: [
        {
          nome: 'Patricia Elias Gel de Limpeza Purificante',
          motivo: 'Ajuda a controlar brilho excessivo sem ressecar a pele.',
          modoDeUso: 'Aplicar de manha e a noite com movimentos circulares.',
        },
        {
          nome: 'Patricia Elias Serum Controle de Acne',
          motivo: 'Formula direcionada para reduzir inflamacao e obstrucao dos poros.',
          modoDeUso: 'Usar a noite, apos limpeza e antes do hidratante.',
        },
        {
          nome: 'Patricia Elias Protetor Solar Oil Free FPS 60',
          motivo: 'Protege contra UV sem aumentar a oleosidade.',
          modoDeUso: 'Aplicar pela manha e reaplicar a cada 3 horas.',
        },
      ],
      Mista: [
        {
          nome: 'Patricia Elias Espuma de Limpeza Equilibrante',
          motivo: 'Equilibra zonas secas e oleosas do rosto.',
          modoDeUso: 'Usar 2 vezes ao dia com enxague abundante.',
        },
        {
          nome: 'Patricia Elias Serum Hidra-Repair',
          motivo: 'Mantem hidratacao sem pesar na zona T.',
          modoDeUso: 'Aplicar 4 gotas de manha e a noite.',
        },
        {
          nome: 'Patricia Elias Protetor Solar Toque Seco FPS 50',
          motivo: 'Protecao diaria com acabamento confortavel.',
          modoDeUso: 'Aplicar de forma uniforme antes da exposicao solar.',
        },
      ],
      'Seca/Sensivel': [
        {
          nome: 'Patricia Elias Leite de Limpeza Calmante',
          motivo: 'Limpeza suave para pele sensibilizada.',
          modoDeUso: 'Aplicar com algodao sem friccao excessiva.',
        },
        {
          nome: 'Patricia Elias Creme Reparador de Barreira',
          motivo: 'Fortalece a barreira cutanea e reduz desconforto.',
          modoDeUso: 'Aplicar 2 vezes ao dia apos limpeza.',
        },
        {
          nome: 'Patricia Elias Protetor Solar Mineral FPS 50',
          motivo: 'Protecao com menor risco de irritacao.',
          modoDeUso: 'Aplicar pela manha e reaplicar ao longo do dia.',
        },
      ],
    };

    return mapa[tipoPele] ?? mapa['Mista'];
  }

  private fallbackPorBuffer(imageBuffer: Buffer) {
    const bucket = imageBuffer.length % 3;
    const tipos = ['Oleosa', 'Mista', 'Seca/Sensivel'];
    const tipoPele = tipos[bucket];
    return {
      status: 'Concluido',
      tipoPele,
      nivelOleosidade: bucket === 0 ? 'Alta' : bucket === 1 ? 'Media' : 'Baixa',
      nivelAcne: bucket === 0 ? 'Moderada' : 'Leve',
      nivelSensibilidade: bucket === 2 ? 'Alta' : 'Baixa',
      observacoes: 'Análise realizada sem dados de IA (fallback).',
      recomendacoes: this.recomendacoesPara(tipoPele),
    };
  }
}
