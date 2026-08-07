-- CreateTable
CREATE TABLE "VideoFlyover" (
    "id" SERIAL NOT NULL,
    "recorridoId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "videoUrl" TEXT,
    "errorMsg" TEXT,
    "duracionSeg" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoFlyover_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VideoFlyover" ADD CONSTRAINT "VideoFlyover_recorridoId_fkey" FOREIGN KEY ("recorridoId") REFERENCES "Recorrido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoFlyover" ADD CONSTRAINT "VideoFlyover_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
