
-- AlterTable
ALTER TABLE "Publicacion" ADD COLUMN "codigoAsistencia" TEXT;
ALTER TABLE "Publicacion" ADD COLUMN "tipoAsistenciaEvento" TEXT;

-- CreateTable
CREATE TABLE "AsistenciaEvento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "publicacionId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AsistenciaEvento_publicacionId_fkey" FOREIGN KEY ("publicacionId") REFERENCES "Publicacion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AsistenciaEvento_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AsistenciaEvento_publicacionId_miembroId_key" ON "AsistenciaEvento"("publicacionId", "miembroId");

