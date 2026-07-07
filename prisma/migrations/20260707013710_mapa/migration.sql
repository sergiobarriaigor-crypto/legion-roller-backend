-- CreateTable
CREATE TABLE "UbicacionActiva" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "miembroId" INTEGER NOT NULL,
    "lat" REAL NOT NULL,
    "lon" REAL NOT NULL,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "UbicacionActiva_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recorrido" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "miembroId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'libre',
    "distanciaKm" REAL NOT NULL,
    "duracionSeg" INTEGER NOT NULL,
    "puntos" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Recorrido_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UbicacionActiva_miembroId_key" ON "UbicacionActiva"("miembroId");
