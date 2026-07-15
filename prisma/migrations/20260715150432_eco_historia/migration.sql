-- CreateTable
CREATE TABLE "EcoHistoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "historiaId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EcoHistoria_historiaId_fkey" FOREIGN KEY ("historiaId") REFERENCES "Historia" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EcoHistoria_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EcoHistoria_historiaId_idx" ON "EcoHistoria"("historiaId");
