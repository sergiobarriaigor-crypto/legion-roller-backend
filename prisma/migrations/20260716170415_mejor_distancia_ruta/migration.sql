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
    "fotoUrl" TEXT,
    "mejorDistanciaRuta" REAL NOT NULL DEFAULT 0
);
INSERT INTO "new_Miembro" ("ciudad", "createdAt", "estadoSetAt", "estadoTexto", "fotoUrl", "id", "nombre", "passwordHash", "rol", "telefono") SELECT "ciudad", "createdAt", "estadoSetAt", "estadoTexto", "fotoUrl", "id", "nombre", "passwordHash", "rol", "telefono" FROM "Miembro";
DROP TABLE "Miembro";
ALTER TABLE "new_Miembro" RENAME TO "Miembro";
CREATE UNIQUE INDEX "Miembro_telefono_key" ON "Miembro"("telefono");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- Backfill: inicializa con la mejor distancia entre las rutas ya guardadas
-- (no pierde el dato de quienes ya tenían recorridos antes de este cambio).
UPDATE "Miembro"
SET "mejorDistanciaRuta" = COALESCE((SELECT MAX("distanciaKm") FROM "Recorrido" WHERE "Recorrido"."miembroId" = "Miembro"."id"), 0);
