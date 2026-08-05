-- AlterTable
ALTER TABLE "Publicacion" ADD COLUMN     "cancelada" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ActividadCalendario" (
    "id" SERIAL NOT NULL,
    "creadorId" INTEGER NOT NULL,
    "categoria" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "hora" TEXT,
    "puntoEncuentro" TEXT,
    "puntoLat" DOUBLE PRECISION,
    "puntoLon" DOUBLE PRECISION,
    "fotoUrl" TEXT,
    "musicaId" TEXT,
    "cancelada" BOOLEAN NOT NULL DEFAULT false,
    "minutosAvisoCreador" INTEGER,
    "avisoCreadorEnviado" BOOLEAN NOT NULL DEFAULT false,
    "aviso24hEnviado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActividadCalendario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitacionActividad" (
    "id" SERIAL NOT NULL,
    "actividadId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvitacionActividad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvitacionActividad_actividadId_miembroId_key" ON "InvitacionActividad"("actividadId", "miembroId");

-- AddForeignKey
ALTER TABLE "ActividadCalendario" ADD CONSTRAINT "ActividadCalendario_creadorId_fkey" FOREIGN KEY ("creadorId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitacionActividad" ADD CONSTRAINT "InvitacionActividad_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "ActividadCalendario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitacionActividad" ADD CONSTRAINT "InvitacionActividad_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
