import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private supabase: SupabaseClient;
  private bucketName = 'places-images'; // Cambia esto por el nombre de tu bucket

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_KEY must be set in environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async uploadImage(file: Express.Multer.File): Promise<string> {
    try {
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `places/${fileName}`;

      // Subir archivo a Supabase Storage
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) {
        this.logger.error(`Error uploading image: ${error.message}`);
        throw new Error(`Error al subir imagen: ${error.message}`);
      }

      // Obtener URL pública
      const { data } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);

      this.logger.log(`Image uploaded successfully: ${data.publicUrl}`);
      return data.publicUrl;
    } catch (error) {
      this.logger.error(`Upload failed: ${error.message}`);
      throw error;
    }
  }

  async deleteImage(imageUrl: string): Promise<void> {
    try {
      // Extraer el path del archivo desde la URL
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split(`/${this.bucketName}/`);
      
      if (pathParts.length < 2) {
        throw new Error('URL de imagen inválida');
      }

      const filePath = pathParts[1];

      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        this.logger.error(`Error deleting image: ${error.message}`);
        throw new Error(`Error al eliminar imagen: ${error.message}`);
      }

      this.logger.log(`Image deleted successfully: ${filePath}`);
    } catch (error) {
      this.logger.error(`Delete failed: ${error.message}`);
      throw error;
    }
  }
}