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
    "mencionadoId" INTEGER,
    "mencionX" REAL,
    "mencionY" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Historia_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Historia_mencionadoId_fkey" FOREIGN KEY ("mencionadoId") REFERENCES "Miembro" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Historia" ("autorId", "createdAt", "id", "mediaUrl", "texto", "textoEstilo", "tipo", "ubicacion") SELECT "autorId", "createdAt", "id", "mediaUrl", "texto", "textoEstilo", "tipo", "ubicacion" FROM "Historia";
DROP TABLE "Historia";
ALTER TABLE "new_Historia" RENAME TO "Historia";
CREATE INDEX "Historia_autorId_idx" ON "Historia"("autorId");
CREATE INDEX "Historia_mencionadoId_idx" ON "Historia"("mencionadoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
