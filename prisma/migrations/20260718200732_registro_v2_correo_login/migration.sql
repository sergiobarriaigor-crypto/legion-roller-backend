-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Miembro" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "correo" TEXT NOT NULL,
    "fechaNacimiento" DATETIME,
    "passwordHash" TEXT NOT NULL,
    "ciudad" TEXT,
    "rol" TEXT NOT NULL DEFAULT 'usuario',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estadoTexto" TEXT,
    "estadoSetAt" DATETIME,
    "fotoUrl" TEXT,
    "mejorDistanciaRuta" REAL NOT NULL DEFAULT 0,
    "ultimaConexion" DATETIME
);
-- Backfill de correo para cuentas existentes (el login pasa de teléfono a
-- correo en esta misma migración): correo = telefono + dominio de marcador
-- de posición, para que el login siga funcionando de inmediato.
INSERT INTO "new_Miembro" ("ciudad", "correo", "createdAt", "estadoSetAt", "estadoTexto", "fotoUrl", "id", "mejorDistanciaRuta", "nombre", "passwordHash", "rol", "telefono", "ultimaConexion") SELECT "ciudad", "telefono" || '@legionroller.local', "createdAt", "estadoSetAt", "estadoTexto", "fotoUrl", "id", "mejorDistanciaRuta", "nombre", "passwordHash", "rol", "telefono", "ultimaConexion" FROM "Miembro";
DROP TABLE "Miembro";
ALTER TABLE "new_Miembro" RENAME TO "Miembro";
CREATE UNIQUE INDEX "Miembro_telefono_key" ON "Miembro"("telefono");
CREATE UNIQUE INDEX "Miembro_correo_key" ON "Miembro"("correo");
CREATE TABLE "new_SolicitudRegistro" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "correo" TEXT,
    "fechaNacimiento" DATETIME,
    "fotoUrl" TEXT,
    "ciudad" TEXT,
    "passwordHash" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SolicitudRegistro" ("ciudad", "createdAt", "estado", "id", "nombre", "passwordHash", "telefono") SELECT "ciudad", "createdAt", "estado", "id", "nombre", "passwordHash", "telefono" FROM "SolicitudRegistro";
DROP TABLE "SolicitudRegistro";
ALTER TABLE "new_SolicitudRegistro" RENAME TO "SolicitudRegistro";
CREATE UNIQUE INDEX "SolicitudRegistro_telefono_key" ON "SolicitudRegistro"("telefono");
CREATE UNIQUE INDEX "SolicitudRegistro_correo_key" ON "SolicitudRegistro"("correo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
