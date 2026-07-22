// Script de datos de prueba (Fase 2). Se ejecuta con: node scripts/seed.js
// Usa better-sqlite3 directo (no Prisma Client) para no depender de compilación TS.
require('dotenv/config');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const dbPath = (process.env.DATABASE_URL || 'file:./dev.db').replace('file:', '');
const db = new Database(path.resolve(__dirname, '..', dbPath));

const cuentas = [
  { nombre: 'Admin', telefono: '900000000', clave: 'admin1234', rol: 'admin', ciudad: 'Puerto Montt' },
  { nombre: 'Camila Usuaria', telefono: '911111111', clave: 'usuario1234', rol: 'usuario', ciudad: 'Puerto Varas' },
];

// Mismo marcador de posición usado en la migración 20260718200732 para las
// cuentas ya existentes (el login pasa de teléfono a correo).
for (const cuenta of cuentas) {
  cuenta.correo = `${cuenta.telefono}@legionroller.local`;
}

const insertar = db.prepare(
  `INSERT INTO Miembro (nombre, telefono, correo, passwordHash, ciudad, rol) VALUES (@nombre, @telefono, @correo, @passwordHash, @ciudad, @rol)`,
);
const buscar = db.prepare(`SELECT id FROM Miembro WHERE telefono = ?`);

for (const cuenta of cuentas) {
  const existe = buscar.get(cuenta.telefono);
  if (existe) {
    console.log(`Ya existe: ${cuenta.nombre} (${cuenta.telefono})`);
    continue;
  }
  const passwordHash = bcrypt.hashSync(cuenta.clave, 10);
  insertar.run({
    nombre: cuenta.nombre,
    telefono: cuenta.telefono,
    passwordHash,
    ciudad: cuenta.ciudad,
    rol: cuenta.rol,
  });
  console.log(`Creado: ${cuenta.nombre} (${cuenta.telefono} / ${cuenta.clave}) — rol ${cuenta.rol}`);
}

db.close();
