-- AlterTable
ALTER TABLE "MensajeChat" ADD COLUMN     "fijado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fijadoEn" TIMESTAMP(3);
