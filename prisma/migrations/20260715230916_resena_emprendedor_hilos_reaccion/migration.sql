-- CreateTable
CREATE TABLE "ReaccionResenaEmprendedor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "resenaId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReaccionResenaEmprendedor_resenaId_fkey" FOREIGN KEY ("resenaId") REFERENCES "ResenaEmprendedor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReaccionResenaEmprendedor_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ResenaEmprendedor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "emprendedorId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "respuestaAId" INTEGER,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResenaEmprendedor_emprendedorId_fkey" FOREIGN KEY ("emprendedorId") REFERENCES "Emprendedor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResenaEmprendedor_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResenaEmprendedor_respuestaAId_fkey" FOREIGN KEY ("respuestaAId") REFERENCES "ResenaEmprendedor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ResenaEmprendedor" ("autorId", "createdAt", "emprendedorId", "id", "texto") SELECT "autorId", "createdAt", "emprendedorId", "id", "texto" FROM "ResenaEmprendedor";
DROP TABLE "ResenaEmprendedor";
ALTER TABLE "new_ResenaEmprendedor" RENAME TO "ResenaEmprendedor";
CREATE INDEX "ResenaEmprendedor_emprendedorId_idx" ON "ResenaEmprendedor"("emprendedorId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ReaccionResenaEmprendedor_resenaId_miembroId_key" ON "ReaccionResenaEmprendedor"("resenaId", "miembroId");
