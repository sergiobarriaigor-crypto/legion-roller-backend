-- AlterTable
ALTER TABLE "Miembro" ADD COLUMN     "bloqueadoHasta" TIMESTAMP(3),
ADD COLUMN     "bloqueadoMotivo" TEXT,
ADD COLUMN     "eliminadoEn" TIMESTAMP(3);
