ALTER TABLE "LecturaChat" ADD COLUMN "entregadoHasta" DATETIME;

-- AlterTable
ALTER TABLE "Miembro" ADD COLUMN "ultimaConexion" DATETIME;

-- CreateTable
CREATE TABLE "ReaccionMensajeChat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mensajeId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReaccionMensajeChat_mensajeId_fkey" FOREIGN KEY ("mensajeId") REFERENCES "MensajeChat" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReaccionMensajeChat_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MensajeChatOculto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mensajeId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MensajeChatOculto_mensajeId_fkey" FOREIGN KEY ("mensajeId") REFERENCES "MensajeChat" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MensajeChatOculto_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MensajeChat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sala" TEXT NOT NULL,
    "autorId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "referenciaTipo" TEXT,
    "referenciaId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respuestaAId" INTEGER,
    "reenviadoDeId" INTEGER,
    "adjuntoTipo" TEXT,
    "adjuntoUrl" TEXT,
    "adjuntoUbicacionNombre" TEXT,
    "adjuntoRutaDistanciaKm" REAL,
    "adjuntoRutaDuracionSeg" INTEGER,
    "adjuntoRutaPuntos" TEXT,
    CONSTRAINT "MensajeChat_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MensajeChat_respuestaAId_fkey" FOREIGN KEY ("respuestaAId") REFERENCES "MensajeChat" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MensajeChat_reenviadoDeId_fkey" FOREIGN KEY ("reenviadoDeId") REFERENCES "MensajeChat" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MensajeChat" ("autorId", "createdAt", "id", "referenciaId", "referenciaTipo", "sala", "texto") SELECT "autorId", "createdAt", "id", "referenciaId", "referenciaTipo", "sala", "texto" FROM "MensajeChat";
DROP TABLE "MensajeChat";
ALTER TABLE "new_MensajeChat" RENAME TO "MensajeChat";
CREATE INDEX "MensajeChat_sala_idx" ON "MensajeChat"("sala");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ReaccionMensajeChat_mensajeId_miembroId_key" ON "ReaccionMensajeChat"("mensajeId", "miembroId");

-- CreateIndex
CREATE UNIQUE INDEX "MensajeChatOculto_mensajeId_miembroId_key" ON "MensajeChatOculto"("mensajeId", "miembroId");

