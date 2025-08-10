// src/place-types/place-types.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlaceTypeDto } from './dto/create-place-type.dto';
import { UpdatePlaceTypeDto } from './dto/update-place-type.dto';

@Injectable()
export class PlaceTypesService {
  constructor(private prisma: PrismaService) {}

  async create(createPlaceTypeDto: CreatePlaceTypeDto) {
    // Verificar que no exista un tipo con el mismo nombre
    const existingType = await this.prisma.placeType.findFirst({
      where: { nombre: createPlaceTypeDto.nombre },
    });

    if (existingType) {
      throw new ConflictException(`Ya existe un tipo de lugar con el nombre "${createPlaceTypeDto.nombre}"`);
    }

    return this.prisma.placeType.create({
      data: createPlaceTypeDto,
    });
  }

  async findAll() {
    return this.prisma.placeType.findMany({
      include: {
        _count: {
          select: { places: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: string) {
    const placeType = await this.prisma.placeType.findUnique({
      where: { id },
      include: {
        places: {
          select: {
            id: true,
            nombre: true,
            latitud: true,
            longitud: true,
            isActive: true,
          },
        },
      },
    });

    if (!placeType) {
      throw new NotFoundException(`Tipo de lugar con ID ${id} no encontrado`);
    }

    return placeType;
  }

  async update(id: string, updatePlaceTypeDto: UpdatePlaceTypeDto) {
    // Verificar que el tipo existe
    await this.findOne(id);

    // Si se está actualizando el nombre, verificar que no exista otro con el mismo nombre
    if (updatePlaceTypeDto.nombre) {
      const existingType = await this.prisma.placeType.findFirst({
        where: { 
          nombre: updatePlaceTypeDto.nombre,
          NOT: { id },
        },
      });

      if (existingType) {
        throw new ConflictException(`Ya existe un tipo de lugar con el nombre "${updatePlaceTypeDto.nombre}"`);
      }
    }

    return this.prisma.placeType.update({
      where: { id },
      data: updatePlaceTypeDto,
    });
  }

  async remove(id: string) {
    // Verificar que el tipo existe
    await this.findOne(id);

    // Verificar que no tenga lugares asociados
    const placesCount = await this.prisma.place.count({
      where: { tipoId: id },
    });

    if (placesCount > 0) {
      throw new ConflictException(`No se puede eliminar el tipo de lugar porque tiene ${placesCount} lugares asociados`);
    }

    return this.prisma.placeType.delete({
      where: { id },
    });
  }

  // Método para obtener estadísticas
  async getStats() {
    const totalTypes = await this.prisma.placeType.count();
    const typesWithPlaces = await this.prisma.placeType.findMany({
      include: {
        _count: {
          select: { places: true },
        },
      },
    });

    return {
      totalTypes,
      typesWithMostPlaces: typesWithPlaces
        .sort((a, b) => b._count.places - a._count.places)
        .slice(0, 5),
    };
  }
}