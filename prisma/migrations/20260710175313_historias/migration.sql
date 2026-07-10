-- CreateTable
CREATE TABLE "Historia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "autorId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "texto" TEXT,
    "ubicacion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Historia_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VistaHistoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "historiaId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "vistaAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VistaHistoria_historiaId_fkey" FOREIGN KEY ("historiaId") REFERENCES "Historia" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VistaHistoria_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Historia_autorId_idx" ON "Historia"("autorId");

-- CreateIndex
CREATE UNIQUE INDEX "VistaHistoria_historiaId_miembroId_key" ON "VistaHistoria"("historiaId", "miembroId");
