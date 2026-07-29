-- CreateTable
CREATE TABLE "ReaccionPublicacion" (
    "id" SERIAL NOT NULL,
    "publicacionId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReaccionPublicacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReaccionPublicacion_publicacionId_miembroId_key" ON "ReaccionPublicacion"("publicacionId", "miembroId");

-- AddForeignKey
ALTER TABLE "ReaccionPublicacion" ADD CONSTRAINT "ReaccionPublicacion_publicacionId_fkey" FOREIGN KEY ("publicacionId") REFERENCES "Publicacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaccionPublicacion" ADD CONSTRAINT "ReaccionPublicacion_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
