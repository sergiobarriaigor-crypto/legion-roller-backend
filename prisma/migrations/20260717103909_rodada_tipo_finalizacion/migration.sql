
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Publicacion" ("activaEnMapa", "createdAt", "duracionHoras", "fecha", "fotos", "hora", "id", "puntoEncuentro", "puntoLat", "puntoLon", "rsvp", "texto", "tipo", "titulo") SELECT "activaEnMapa", "createdAt", "duracionHoras", "fecha", "fotos", "hora", "id", "puntoEncuentro", "puntoLat", "puntoLon", "rsvp", "texto", "tipo", "titulo" FROM "Publicacion";
DROP TABLE "Publicacion";
ALTER TABLE "new_Publicacion" RENAME TO "Publicacion";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

