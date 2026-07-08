-- CreateTable
CREATE TABLE "MensajeChat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sala" TEXT NOT NULL,
    "autorId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "referenciaTipo" TEXT,
    "referenciaId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MensajeChat_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LecturaChat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "miembroId" INTEGER NOT NULL,
    "sala" TEXT NOT NULL,
    "leidoHasta" DATETIME NOT NULL,
    CONSTRAINT "LecturaChat_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MensajeChat_sala_idx" ON "MensajeChat"("sala");

-- CreateIndex
CREATE UNIQUE INDEX "LecturaChat_miembroId_sala_key" ON "LecturaChat"("miembroId", "sala");
