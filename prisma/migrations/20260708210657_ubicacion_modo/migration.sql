-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UbicacionActiva" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "miembroId" INTEGER NOT NULL,
    "lat" REAL NOT NULL,
    "lon" REAL NOT NULL,
    "modo" TEXT NOT NULL DEFAULT 'patinando',
    "iniciadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "UbicacionActiva_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UbicacionActiva" ("actualizadoEn", "id", "lat", "lon", "miembroId") SELECT "actualizadoEn", "id", "lat", "lon", "miembroId" FROM "UbicacionActiva";
DROP TABLE "UbicacionActiva";
ALTER TABLE "new_UbicacionActiva" RENAME TO "UbicacionActiva";
CREATE UNIQUE INDEX "UbicacionActiva_miembroId_key" ON "UbicacionActiva"("miembroId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
