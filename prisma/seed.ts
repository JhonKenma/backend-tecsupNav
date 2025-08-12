// prisma/seed.ts
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...');

  // Crear usuarios
  await seedUsers();
  await seedPlaceTypes();
  await seedPlaces();
  
  console.log('🎉 Seed completado exitosamente!');
}

async function seedUsers() {
  console.log('👥 Creando usuarios...');

  // Crear usuario administrador por defecto
  const adminEmail = 'admin@tecsup.edu.pe';
  const adminPassword = 'Admin123456';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'Adminweb',
        role: UserRole.ADMIN,
      },
    });

    console.log(`✅ Usuario administrador creado: ${admin.email}`);
  } else {
    console.log('ℹ️  Usuario administrador ya existe');
  }

  // Crear usuario estudiante de prueba
  const studentEmail = 'jhon.herrera@tecsup.edu.pe';
  const studentPassword = '12345678';

  const existingStudent = await prisma.user.findUnique({
    where: { email: studentEmail },
  });

  if (!existingStudent) {
    const hashedPassword = await bcrypt.hash(studentPassword, 12);
    
    const student = await prisma.user.create({
      data: {
        email: studentEmail,
        password: hashedPassword,
        firstName: 'Estudiante',
        lastName: 'Test',
        role: UserRole.STUDENT,
      },
    });

    console.log(`✅ Usuario estudiante creado: ${student.email}`);
  } else {
    console.log('ℹ️  Usuario estudiante ya existe');
  }
}

async function seedPlaceTypes() {
  console.log('📍 Creando tipos de lugares...');

  const placeTypes = [
    {
      nombre: 'Aula',
      descripcion: 'Salones de clases para enseñanza teórica',
      icono: 'classroom',
      color: '#2563EB', // Azul
    },
    {
      nombre: 'Laboratorio',
      descripcion: 'Espacios equipados para práctica',
      icono: 'science',
      color: '#DC2626', // Rojo
    },
    {
      nombre: 'Oficina',
      descripcion: 'Oficinas administrativas y docentes',
      icono: 'office',
      color: '#059669', // Verde
    },
    {
      nombre: 'Biblioteca',
      descripcion: 'Espacios de estudio y consulta bibliográfica',
      icono: 'library',
      color: '#7C3AED', // Púrpura
    },
    {
      nombre: 'Auditorio',
      descripcion: 'Espacios para eventos y conferencias',
      icono: 'theater',
      color: '#EA580C', // Naranja
    },
    {
      nombre: 'Cafetería',
      descripcion: 'Espacios de alimentación y descanso',
      icono: 'restaurant',
      color: '#D97706', // Ámbar
    },
    {
      nombre: 'Baño',
      descripcion: 'Servicios higiénicos',
      icono: 'wc',
      color: '#6B7280', // Gris
    },
    {
      nombre: 'Entrada',
      descripcion: 'Accesos principales y secundarios',
      icono: 'door',
      color: '#1F2937', // Gris oscuro
    },
  ];

  for (const typeData of placeTypes) {
    const existing = await prisma.placeType.findFirst({
      where: { nombre: typeData.nombre },
    });

    if (!existing) {
      await prisma.placeType.create({ data: typeData });
      console.log(`   ✅ Tipo creado: ${typeData.nombre}`);
    } else {
      console.log(`   ℹ️  Tipo ya existe: ${typeData.nombre}`);
    }
  }
}

async function seedPlaces() {
  console.log('🏢 Creando lugares de ejemplo...');

  // Obtener tipos de lugar para las relaciones
  const aula = await prisma.placeType.findFirst({ where: { nombre: 'Aula' } });
  const laboratorio = await prisma.placeType.findFirst({ where: { nombre: 'Laboratorio' } });
  //const oficina = await prisma.placeType.findFirst({ where: { nombre: 'Oficina' } });
  const biblioteca = await prisma.placeType.findFirst({ where: { nombre: 'Biblioteca' } });
  const cafeteria = await prisma.placeType.findFirst({ where: { nombre: 'Cafetería' } });
  const entrada = await prisma.placeType.findFirst({ where: { nombre: 'Entrada' } });

  // Lugares de ejemplo (coordenadas ficticias para Lima, Perú)
  // Estas coordenadas deberían ser reemplazadas por las coordenadas reales del campus
  const places = [
    // Entradas
    {
      nombre: 'Entrada Principal',
      latitud: -12.045352,//-12.045352, -76.952343
      longitud: -76.952343,
      tipoId: entrada?.id || '',
      descripcion: 'Acceso principal al campus',
      edificio: 'Entrada',
      piso: 0,
    },
    
    // Pabellón A - Aulas
    {
      nombre: 'Aula A101',
      latitud: -12.0455,
      longitud: -77.0355,
      tipoId: aula?.id || '',
      descripcion: 'Aula de clases teóricas con capacidad para 40 estudiantes',
      edificio: 'Pabellón A',
      piso: 1,
    },
    {
      nombre: 'Aula A201',
      latitud: -12.0456,
      longitud: -77.0356,
      tipoId: aula?.id || '',
      descripcion: 'Aula con proyector y sistema de audio',
      edificio: 'Pabellón A',
      piso: 2,
    },

    // Pabellón B - Laboratorios
    {
      nombre: 'Laboratorio de Electrónica',
      latitud: -12.0460,
      longitud: -77.0360,
      tipoId: laboratorio?.id || '',
      descripcion: 'Laboratorio equipado con componentes electrónicos',
      edificio: 'Pabellón B',
      piso: 1,
    },
    {
      nombre: 'Laboratorio de Redes',
      latitud: -12.0461,
      longitud: -77.0361,
      tipoId: laboratorio?.id || '',
      descripcion: 'Laboratorio con equipos de networking Cisco',
      edificio: 'Pabellón B',
      piso: 1,
    },

    // Biblioteca
    {
      nombre: 'Biblioteca Central',
      latitud: -12.0470,
      longitud: -77.0370,
      tipoId: biblioteca?.id || '',
      descripcion: 'Biblioteca principal con sala de estudio',
      edificio: 'Biblioteca',
      piso: 1,
    },

    // Cafetería
    {
      nombre: 'Cafetería Principal',
      latitud: -12.0475,
      longitud: -77.0375,
      tipoId: cafeteria?.id || '',
      descripcion: 'Zona de alimentación con mesas y sillas',
      edificio: 'Cafetería',
      piso: 1,
    },
  ];

  for (const placeData of places) {
    // Validar que tipoId no esté vacío antes de crear
    if (!placeData.tipoId) {
      console.log(`   ⚠️  Saltando ${placeData.nombre}: tipo no encontrado`);
      continue;
    }

    const existing = await prisma.place.findFirst({
      where: { nombre: placeData.nombre },
    });

    if (!existing) {
      await prisma.place.create({ data: placeData });
      console.log(`   ✅ Lugar creado: ${placeData.nombre}`);
    } else {
      console.log(`   ℹ️  Lugar ya existe: ${placeData.nombre}`);
    }
  }
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });