
-- AlterTable
ALTER TABLE "Publicacion" ADD COLUMN "puntoLat" REAL;
ALTER TABLE "Publicacion" ADD COLUMN "puntoLon" REAL;

-- CreateTable
CREATE TABLE "AsistenciaRodada" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "publicacionId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "recorridoId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AsistenciaRodada_publicacionId_fkey" FOREIGN KEY ("publicacionId") REFERENCES "Publicacion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AsistenciaRodada_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AsistenciaRodada_recorridoId_fkey" FOREIGN KEY ("recorridoId") REFERENCES "Recorrido" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AsistenciaRodada_recorridoId_key" ON "AsistenciaRodada"("recorridoId");

-- CreateIndex
CREATE UNIQUE INDEX "AsistenciaRodada_publicacionId_miembroId_key" ON "AsistenciaRodada"("publicacionId", "miembroId");

