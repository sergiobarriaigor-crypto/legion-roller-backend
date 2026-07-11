/*
  Warnings:

  - You are about to drop the column `mencionAceptada` on the `Historia` table. All the data in the column will be lost.
  - You are about to drop the column `mencionX` on the `Historia` table. All the data in the column will be lost.
  - You are about to drop the column `mencionY` on the `Historia` table. All the data in the column will be lost.
  - You are about to drop the column `mencionadoId` on the `Historia` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "MencionHistoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "historiaId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "escala" REAL NOT NULL DEFAULT 1,
    "aceptada" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MencionHistoria_historiaId_fkey" FOREIGN KEY ("historiaId") REFERENCES "Historia" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MencionHistoria_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Historia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "autorId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "texto" TEXT,
    "textoEstilo" TEXT,
    "ubicacion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Historia_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Historia" ("autorId", "createdAt", "id", "mediaUrl", "texto", "textoEstilo", "tipo", "ubicacion") SELECT "autorId", "createdAt", "id", "mediaUrl", "texto", "textoEstilo", "tipo", "ubicacion" FROM "Historia";
DROP TABLE "Historia";
ALTER TABLE "new_Historia" RENAME TO "Historia";
CREATE INDEX "Historia_autorId_idx" ON "Historia"("autorId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MencionHistoria_historiaId_miembroId_key" ON "MencionHistoria"("historiaId", "miembroId");
