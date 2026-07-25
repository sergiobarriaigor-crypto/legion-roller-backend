-- AlterTable
ALTER TABLE "Miembro" ADD COLUMN     "kmTotalesAcumulados" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "kmOficialesAcumulados" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "duracionSegAcumulada" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "numRutasAcumuladas" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Recorrido" ADD COLUMN     "mapeado" BOOLEAN NOT NULL DEFAULT true;
