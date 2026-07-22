// Script de datos de prueba. Se ejecuta con: node scripts/seed.js (requiere
// haber corrido antes "npm run build" — usa el cliente ya compilado en dist/,
// porque "prisma generate" en algunos entornos de build (ej. Railway) solo
// deja el .ts fuente sin transpilar, y dist/ es lo único consistente entre
// entornos ya que lo compila nuestro propio "nest build").
// Usa Prisma Client (mismo adapter que la app) para funcionar contra
// cualquier base de datos configurada en DATABASE_URL (SQLite local o
// Postgres en producción).
require('dotenv/config');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('../dist/generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const cuentas = [
  { nombre: 'Admin', telefono: '900000000', clave: 'admin1234', rol: 'admin', ciudad: 'Puerto Montt' },
  { nombre: 'Camila Usuaria', telefono: '911111111', clave: 'usuario1234', rol: 'usuario', ciudad: 'Puerto Varas' },
];

async function main() {
  for (const cuenta of cuentas) {
    const correo = `${cuenta.telefono}@legionroller.local`;
    const existe = await prisma.miembro.findUnique({ where: { correo } });
    if (existe) {
      console.log(`Ya existe: ${cuenta.nombre} (${correo})`);
      continue;
    }
    const passwordHash = await bcrypt.hash(cuenta.clave, 10);
    await prisma.miembro.create({
      data: {
        nombre: cuenta.nombre,
        telefono: cuenta.telefono,
        correo,
        passwordHash,
        ciudad: cuenta.ciudad,
        rol: cuenta.rol,
      },
    });
    console.log(`Creado: ${cuenta.nombre} (${correo} / ${cuenta.clave}) — rol ${cuenta.rol}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
