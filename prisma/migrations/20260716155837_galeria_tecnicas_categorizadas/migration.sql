-- CreateTable
CREATE TABLE "MiembroTecnica" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "miembroId" INTEGER NOT NULL,
    "tecnica" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MiembroTecnica_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FotoGaleria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "miembroId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotoGaleria_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReaccionFotoGaleria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fotoId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReaccionFotoGaleria_fotoId_fkey" FOREIGN KEY ("fotoId") REFERENCES "FotoGaleria" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReaccionFotoGaleria_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Miembro" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "ciudad" TEXT,
    "rol" TEXT NOT NULL DEFAULT 'usuario',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estadoTexto" TEXT,
    "estadoSetAt" DATETIME,
    "fotoUrl" TEXT
);
INSERT INTO "new_Miembro" ("ciudad", "createdAt", "estadoSetAt", "estadoTexto", "fotoUrl", "id", "nombre", "passwordHash", "rol", "telefono") SELECT "ciudad", "createdAt", "estadoSetAt", "estadoTexto", "fotoUrl", "id", "nombre", "passwordHash", "rol", "telefono" FROM "Miembro";
DROP TABLE "Miembro";
ALTER TABLE "new_Miembro" RENAME TO "Miembro";
CREATE UNIQUE INDEX "Miembro_telefono_key" ON "Miembro"("telefono");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MiembroTecnica_miembroId_tecnica_key" ON "MiembroTecnica"("miembroId", "tecnica");

-- CreateIndex
CREATE INDEX "FotoGaleria_miembroId_idx" ON "FotoGaleria"("miembroId");

-- CreateIndex
CREATE UNIQUE INDEX "ReaccionFotoGaleria_fotoId_miembroId_key" ON "ReaccionFotoGaleria"("fotoId", "miembroId");

