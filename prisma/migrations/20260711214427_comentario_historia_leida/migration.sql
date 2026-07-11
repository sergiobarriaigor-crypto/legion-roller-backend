-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ComentarioHistoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "historiaId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "respuestaAId" INTEGER,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComentarioHistoria_historiaId_fkey" FOREIGN KEY ("historiaId") REFERENCES "Historia" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ComentarioHistoria_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ComentarioHistoria_respuestaAId_fkey" FOREIGN KEY ("respuestaAId") REFERENCES "ComentarioHistoria" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ComentarioHistoria" ("autorId", "createdAt", "historiaId", "id", "respuestaAId", "texto") SELECT "autorId", "createdAt", "historiaId", "id", "respuestaAId", "texto" FROM "ComentarioHistoria";
DROP TABLE "ComentarioHistoria";
ALTER TABLE "new_ComentarioHistoria" RENAME TO "ComentarioHistoria";
CREATE INDEX "ComentarioHistoria_historiaId_idx" ON "ComentarioHistoria"("historiaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
