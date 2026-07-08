-- CreateTable
CREATE TABLE "Emergencia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "miembroId" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "requiereAmbulancia" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltaAt" DATETIME,
    CONSTRAINT "Emergencia_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
