// src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: () => {
        // ✅ SINGLETON: Usar factory method para control explícito
        return PrismaService.getInstance();
      },
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}