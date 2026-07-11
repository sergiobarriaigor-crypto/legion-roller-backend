-- CreateTable
CREATE TABLE "ReaccionHistoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "historiaId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReaccionHistoria_historiaId_fkey" FOREIGN KEY ("historiaId") REFERENCES "Historia" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReaccionHistoria_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ReaccionHistoria_historiaId_miembroId_key" ON "ReaccionHistoria"("historiaId", "miembroId");
