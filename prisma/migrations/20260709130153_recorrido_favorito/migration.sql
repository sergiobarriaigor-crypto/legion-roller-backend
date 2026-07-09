-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Recorrido" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "miembroId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'libre',
    "distanciaKm" REAL NOT NULL,
    "duracionSeg" INTEGER NOT NULL,
    "puntos" TEXT NOT NULL,
    "favorito" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Recorrido_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Recorrido" ("createdAt", "distanciaKm", "duracionSeg", "id", "miembroId", "puntos", "tipo") SELECT "createdAt", "distanciaKm", "duracionSeg", "id", "miembroId", "puntos", "tipo" FROM "Recorrido";
DROP TABLE "Recorrido";
ALTER TABLE "new_Recorrido" RENAME TO "Recorrido";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
