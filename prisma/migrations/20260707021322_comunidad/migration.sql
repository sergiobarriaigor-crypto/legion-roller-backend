-- CreateTable
CREATE TABLE "Publicacion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "fecha" TEXT,
    "hora" TEXT,
    "puntoEncuentro" TEXT,
    "rsvp" BOOLEAN NOT NULL DEFAULT false,
    "duracionHoras" INTEGER,
    "activaEnMapa" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RsvpRespuesta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "publicacionId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "estado" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "RsvpRespuesta_publicacionId_fkey" FOREIGN KEY ("publicacionId") REFERENCES "Publicacion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RsvpRespuesta_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RsvpRespuesta_publicacionId_miembroId_key" ON "RsvpRespuesta"("publicacionId", "miembroId");
