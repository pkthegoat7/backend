import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    // Configurar Supabase com as credenciais (serão lidas do .env)
    const supabaseUrl = process.env.SUPABASE_URL || 'https://hblkedovrbimnzgobnau.supabase.co';
    const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibGtlZG92cmJpbW56Z29ibmF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTkwMDAwMDAwMH0.example-key';
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Fazer upload de uma imagem para Supabase Storage
   * @param file - Arquivo de imagem
   * @param userId - ID do usuário
   * @returns URL pública da imagem
   */
  async uploadImage(file: Express.Multer.File, userId: string): Promise<string> {
    try {
      // Gerar nome único para a imagem
      const timestamp = Date.now();
      const fileName = `${userId}-${timestamp}-${file.originalname}`;
      const bucketName = 'analises-imagens';

      // Fazer upload para Supabase Storage
      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .upload(`${userId}/${fileName}`, file.buffer, {
          contentType: file.mimetype,
        });

      if (error) {
        throw new Error(`Erro ao fazer upload: ${error.message}`);
      }

      // Gerar URL pública da imagem
      const { data: publicUrl } = this.supabase.storage
        .from(bucketName)
        .getPublicUrl(`${userId}/${fileName}`);

      return publicUrl.publicUrl;
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
      throw error;
    }
  }
}
