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
    // 👉 Nuevos tipos agregados
    {
      nombre: 'Pabellón',
      descripcion: 'Estructuras principales que agrupan aulas y oficinas',
      icono: 'apartment', // o 'building' si usas Material Icons
      color: '#0EA5E9', // Celeste
    },
    {
      nombre: 'Módulo',
      descripcion: 'Bloques o secciones del campus con aulas o talleres',
      icono: 'domain', // o 'view_module'
      color: '#9333EA', // Violeta
    },
    {
      nombre: 'Fab Lab',
      descripcion: 'Laboratorio de fabricación digital y prototipado',
      icono: 'precision_manufacturing', // Ícono de herramientas
      color: '#22C55E', // Verde brillante
    },
    {
      nombre: 'Polideportivo',
      descripcion: 'Instalaciones para actividades deportivas y recreativas',
      icono: 'sports_soccer', // Ícono deportivo
      color: '#F59E0B', // Amarillo dorado
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
  console.log('🏢 Creando lugares reales...');

  // Buscar tipos existentes en la base de datos
  const aula = await prisma.placeType.findFirst({ where: { nombre: 'Aula' } });
  const laboratorio = await prisma.placeType.findFirst({ where: { nombre: 'Laboratorio' } });
  const oficina = await prisma.placeType.findFirst({ where: { nombre: 'Oficina' } });
  const bano = await prisma.placeType.findFirst({ where: { nombre: 'Baño' } });
  const polideportivo = await prisma.placeType.findFirst({ where: { nombre: 'Polideportivo' } });

  // Solo los lugares reales registrados
  const places = [
    // 🏫 Aulas
    {
      nombre: 'Aula 400',
      latitud: -12.04464,
      longitud: -76.95292,
      tipoId: aula?.id || '',
      descripcion: 'Aula de clases teóricas en el Pabellón 4',
      edificio: 'Pabellón 4',
      piso: 1,
    },
    {
      nombre: 'Aula 1102',
      latitud: -12.04389,
      longitud: -76.95236,
      tipoId: aula?.id || '',
      descripcion: 'Aula ubicada en el primer piso del Pabellón 11',
      edificio: 'Pabellón 11',
      piso: 1,
    },
    {
      nombre: 'Aula 4B-01',
      latitud: -12.044595,
      longitud: -76.953088,
      tipoId: aula?.id || '',
      descripcion: 'Aula ubicada por el Polideportivo, primer piso',
      edificio: 'Zona Polideportivo Pabellón 4B',
      piso: 1,
    },
    {
      nombre: 'Aula 4B-02',
      latitud: -12.043890,
      longitud: -76.953908,
      tipoId: aula?.id || '',
      descripcion: 'Aula ubicada por el Polideportivo, primer piso',
      edificio: 'Zona Polideportivo Pabellón 4B',
      piso: 1,
    },
    {
      nombre: 'Aula 4B-03',
      latitud: -12.044709,
      longitud: -76.955788,
      tipoId: aula?.id || '',
      descripcion: 'Aula ubicada por el Polideportivo, primer piso',
      edificio: 'Zona Polideportivo Pabellón 4B',
      piso: 1,
    },

    // 🔬 Laboratorios
    {
      nombre: 'Laboratorio 802',
      latitud: -12.04464,
      longitud: -76.95256,
      tipoId: laboratorio?.id || '',
      descripcion: 'Laboratorio del Pabellón 8',
      edificio: 'Pabellón 8',
      piso: 1,
    },
    {
      nombre: 'Laboratorio 1007',
      latitud: -12.04381,
      longitud: -76.95264,
      tipoId: laboratorio?.id || '',
      descripcion: 'Laboratorio del Pabellón 10',
      edificio: 'Pabellón 10',
      piso: 1,
    },
    {
      nombre: 'Laboratorio 812',
      latitud: -12.04414,
      longitud: -76.95256,
      tipoId: laboratorio?.id || '',
      descripcion: 'Laboratorio del Pabellón 8',
      edificio: 'Pabellón 8',
      piso: 1,
    },
    {
      nombre: 'Laboratorio 410',
      latitud: -12.044723,
      longitud: -76.952942,
      tipoId: laboratorio?.id || '',
      descripcion: 'Laboratorio en el Pabellón 4, segundo piso',
      edificio: 'Pabellón 4',
      piso: 2,
    },
    {
      nombre: 'Laboratorio 412',
      latitud: -12.044718,
      longitud: -76.952995,
      tipoId: laboratorio?.id || '',
      descripcion: 'Laboratorio en el Pabellón 4, segundo piso',
      edificio: 'Pabellón 4',
      piso: 2,
    },
    {
      nombre: 'Laboratorio 411',
      latitud: -12.044710,
      longitud: -76.952965,
      tipoId: laboratorio?.id || '',
      descripcion: 'Laboratorio en el Pabellón 4, segundo piso',
      edificio: 'Pabellón 4',
      piso: 2,
    },
    {
      nombre: 'Laboratorio 418',
      latitud: -12.044685,
      longitud: -76.953395,
      tipoId: laboratorio?.id || '',
      descripcion: 'Laboratorio en el Pabellón 4, segundo piso',
      edificio: 'Pabellón 4',
      piso: 2,
    },

    // 🧑‍💼 Oficina
    {
      nombre: 'Oficina - Soporte TI',
      latitud: -12.044688,
      longitud: -76.9529734,
      tipoId: oficina?.id || '',
      descripcion: 'Oficina de Soporte TI en el segundo piso del Pabellón 4',
      edificio: 'Pabellón 4',
      piso: 2,
    },

    // 🚻 Servicios higiénicos
    {
      nombre: 'Servicios Higiénicos (Pabellón 4)',
      latitud: -12.042092,
      longitud: -76.952253,
      tipoId: bano?.id || '',
      descripcion: 'Servicios higiénicos ubicados cerca del Pabellón 4',
      edificio: 'Pabellón 4',
      piso: 1,
    },
    {
      nombre: 'SS.HH. Segundo Piso - Pabellón 4',
      latitud: -12.044695,
      longitud: -76.953040,
      tipoId: bano?.id || '',
      descripcion: 'Servicios higiénicos ubicados en el segundo piso del Pabellón 4',
      edificio: 'Pabellón 4',
      piso: 2,
    },

    // ⚽ Polideportivo
    {
      nombre: 'Polideportivo',
      latitud: -12.044987,
      longitud: -76.952885,
      tipoId: polideportivo?.id || '',
      descripcion: 'Zona del Polideportivo donde también se ubican baños',
      edificio: 'Polideportivo',
      piso: 1,
    },
  ];

  // Crear lugares si no existen
  for (const placeData of places) {
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