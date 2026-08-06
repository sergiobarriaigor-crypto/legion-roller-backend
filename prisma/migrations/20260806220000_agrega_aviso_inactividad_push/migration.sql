-- AlterTable
ALTER TABLE "UbicacionActiva" ADD COLUMN     "movimientoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "avisoInactividadEnviado" BOOLEAN NOT NULL DEFAULT false;
