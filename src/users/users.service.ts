// src/users/users.service.ts
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: UserRole;
  }): Promise<User> {
    // Verificar si el usuario ya existe
    const existingUser = await this.findByEmail(userData.email);
    if (existingUser) {
      throw new ConflictException('El correo ya está registrado');
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(userData.password, 12);

    return this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
        role: userData.role || UserRole.STUDENT,
      },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { googleId },
    });
  }

  async createGoogleUser(userData: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        ...userData,
        role: UserRole.STUDENT, // Los usuarios de Google siempre son estudiantes
      },
    });
  }

  async updateGoogleId(userId: string, googleId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { googleId },
    });
  }

  async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { updatedAt: new Date() },
    });
  }

  // NUEVO: Obtener todos los usuarios que se registraron con Google
  async findGoogleUsers(): Promise<Omit<User, 'password'>[]> {
    return this.prisma.user.findMany({
      where: {
        googleId: {
          not: null, // Solo usuarios que tienen googleId
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        googleId: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        password: false, // Excluir password explícitamente
      },
      orderBy: {
        createdAt: 'desc', // Más recientes primero
      },
    });
  }

  // OPCIONAL: Obtener estadísticas de usuarios Google
  async getGoogleUsersStats() {
    const total = await this.prisma.user.count({
      where: {
        googleId: { not: null },
      },
    });

    const active = await this.prisma.user.count({
      where: {
        googleId: { not: null },
        isActive: true,
      },
    });

    const inactive = total - active;

    return {
      total,
      active,
      inactive,
    };
  }  
}