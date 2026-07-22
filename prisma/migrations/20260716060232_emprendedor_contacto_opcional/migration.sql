-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Emprendedor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "miembroId" INTEGER NOT NULL,
    "nombreNegocio" TEXT NOT NULL,
    "rubro" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "contacto" TEXT,
    "ubicacion" TEXT,
    "instagram" TEXT,
    "facebook" TEXT,
    "tiktok" TEXT,
    "fotos" TEXT,
    "aprobado" BOOLEAN NOT NULL DEFAULT false,
    "solicitadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Emprendedor_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Emprendedor" ("aprobado", "contacto", "descripcion", "facebook", "fotos", "id", "instagram", "miembroId", "nombreNegocio", "rubro", "solicitadoAt", "tiktok", "ubicacion") SELECT "aprobado", "contacto", "descripcion", "facebook", "fotos", "id", "instagram", "miembroId", "nombreNegocio", "rubro", "solicitadoAt", "tiktok", "ubicacion" FROM "Emprendedor";
DROP TABLE "Emprendedor";
ALTER TABLE "new_Emprendedor" RENAME TO "Emprendedor";
CREATE UNIQUE INDEX "Emprendedor_miembroId_key" ON "Emprendedor"("miembroId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
