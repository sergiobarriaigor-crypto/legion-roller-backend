-- CreateTable
CREATE TABLE "EncuestaChat" (
    "id" SERIAL NOT NULL,
    "mensajeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EncuestaChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpcionEncuestaChat" (
    "id" SERIAL NOT NULL,
    "encuestaId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,

    CONSTRAINT "OpcionEncuestaChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VotoEncuestaChat" (
    "id" SERIAL NOT NULL,
    "encuestaId" INTEGER NOT NULL,
    "opcionId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VotoEncuestaChat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EncuestaChat_mensajeId_key" ON "EncuestaChat"("mensajeId");

-- CreateIndex
CREATE UNIQUE INDEX "VotoEncuestaChat_encuestaId_miembroId_key" ON "VotoEncuestaChat"("encuestaId", "miembroId");

-- AddForeignKey
ALTER TABLE "EncuestaChat" ADD CONSTRAINT "EncuestaChat_mensajeId_fkey" FOREIGN KEY ("mensajeId") REFERENCES "MensajeChat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpcionEncuestaChat" ADD CONSTRAINT "OpcionEncuestaChat_encuestaId_fkey" FOREIGN KEY ("encuestaId") REFERENCES "EncuestaChat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotoEncuestaChat" ADD CONSTRAINT "VotoEncuestaChat_encuestaId_fkey" FOREIGN KEY ("encuestaId") REFERENCES "EncuestaChat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotoEncuestaChat" ADD CONSTRAINT "VotoEncuestaChat_opcionId_fkey" FOREIGN KEY ("opcionId") REFERENCES "OpcionEncuestaChat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotoEncuestaChat" ADD CONSTRAINT "VotoEncuestaChat_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
