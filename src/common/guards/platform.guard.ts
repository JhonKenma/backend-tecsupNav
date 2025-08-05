// src/common/guards/platform.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

@Injectable()
export class MobileOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // Solo estudiantes pueden acceder desde móvil
    if (user.role !== UserRole.STUDENT) {
      throw new ForbiddenException('Solo estudiantes pueden acceder desde la aplicación móvil');
    }
    
    return true;
  }
}

@Injectable()
export class WebOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // Solo administradores pueden acceder desde web
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo administradores pueden acceder desde la web');
    }
    
    return true;
  }
}