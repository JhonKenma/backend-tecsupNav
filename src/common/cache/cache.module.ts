// src/common/cache/cache.module.ts
import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';

@Global()
@Module({
  imports: [
    NestCacheModule.register({
      ttl: 300, // 5 minutos
      max: 100, // Máximo 100 items en caché
      isGlobal: true,
    }),
  ],
  exports: [NestCacheModule],
})
export class CacheModule {}