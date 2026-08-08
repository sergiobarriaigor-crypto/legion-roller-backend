-- CreateTable
CREATE TABLE "TokenPushNativo" (
    "id" SERIAL NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenPushNativo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TokenPushNativo_token_key" ON "TokenPushNativo"("token");

-- AddForeignKey
ALTER TABLE "TokenPushNativo" ADD CONSTRAINT "TokenPushNativo_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
