-- CreateTable
CREATE TABLE "ReconocimientoRecibido" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deId" INTEGER NOT NULL,
    "paraId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReconocimientoRecibido_deId_fkey" FOREIGN KEY ("deId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReconocimientoRecibido_paraId_fkey" FOREIGN KEY ("paraId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "tecnicaT" BOOLEAN NOT NULL DEFAULT false,
    "tecnicaSoul" BOOLEAN NOT NULL DEFAULT false,
    "tecnicaMaggi" BOOLEAN NOT NULL DEFAULT false,
    "tecnicaParallel" BOOLEAN NOT NULL DEFAULT false,
    "estadoTexto" TEXT,
    "estadoSetAt" DATETIME
);
INSERT INTO "new_Miembro" ("ciudad", "createdAt", "id", "nombre", "passwordHash", "rol", "telefono") SELECT "ciudad", "createdAt", "id", "nombre", "passwordHash", "rol", "telefono" FROM "Miembro";
DROP TABLE "Miembro";
ALTER TABLE "new_Miembro" RENAME TO "Miembro";
CREATE UNIQUE INDEX "Miembro_telefono_key" ON "Miembro"("telefono");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
