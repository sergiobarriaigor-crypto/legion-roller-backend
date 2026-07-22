
-- CreateTable
CREATE TABLE "SuscripcionPush" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "miembroId" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SuscripcionPush_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Publicacion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "fecha" TEXT,
    "hora" TEXT,
    "puntoEncuentro" TEXT,
    "puntoLat" REAL,
    "puntoLon" REAL,
    "tipoFinalizacion" TEXT,
    "puntoFinLat" REAL,
    "puntoFinLon" REAL,
    "distanciaMinimaKm" REAL,
    "cerrada" BOOLEAN NOT NULL DEFAULT false,
    "rsvp" BOOLEAN NOT NULL DEFAULT false,
    "duracionHoras" INTEGER,
    "activaEnMapa" BOOLEAN NOT NULL DEFAULT false,
    "fotos" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordatorioEnviado" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Publicacion" ("activaEnMapa", "cerrada", "createdAt", "distanciaMinimaKm", "duracionHoras", "fecha", "fotos", "hora", "id", "puntoEncuentro", "puntoFinLat", "puntoFinLon", "puntoLat", "puntoLon", "rsvp", "texto", "tipo", "tipoFinalizacion", "titulo") SELECT "activaEnMapa", "cerrada", "createdAt", "distanciaMinimaKm", "duracionHoras", "fecha", "fotos", "hora", "id", "puntoEncuentro", "puntoFinLat", "puntoFinLon", "puntoLat", "puntoLon", "rsvp", "texto", "tipo", "tipoFinalizacion", "titulo" FROM "Publicacion";
DROP TABLE "Publicacion";
ALTER TABLE "new_Publicacion" RENAME TO "Publicacion";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SuscripcionPush_endpoint_key" ON "SuscripcionPush"("endpoint");

