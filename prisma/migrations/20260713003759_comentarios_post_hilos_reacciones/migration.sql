-- CreateTable
CREATE TABLE "ReaccionComentarioPost" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "comentarioId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReaccionComentarioPost_comentarioId_fkey" FOREIGN KEY ("comentarioId") REFERENCES "ComentarioPost" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReaccionComentarioPost_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ComentarioPost" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "postId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "respuestaAId" INTEGER,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComentarioPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ComentarioPost_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ComentarioPost_respuestaAId_fkey" FOREIGN KEY ("respuestaAId") REFERENCES "ComentarioPost" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ComentarioPost" ("autorId", "createdAt", "id", "postId", "texto") SELECT "autorId", "createdAt", "id", "postId", "texto" FROM "ComentarioPost";
DROP TABLE "ComentarioPost";
ALTER TABLE "new_ComentarioPost" RENAME TO "ComentarioPost";
CREATE INDEX "ComentarioPost_postId_idx" ON "ComentarioPost"("postId");
CREATE TABLE "new_ReaccionPost" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "postId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReaccionPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReaccionPost_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ReaccionPost" ("createdAt", "id", "miembroId", "postId") SELECT "createdAt", "id", "miembroId", "postId" FROM "ReaccionPost";
DROP TABLE "ReaccionPost";
ALTER TABLE "new_ReaccionPost" RENAME TO "ReaccionPost";
CREATE UNIQUE INDEX "ReaccionPost_postId_miembroId_key" ON "ReaccionPost"("postId", "miembroId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ReaccionComentarioPost_comentarioId_miembroId_key" ON "ReaccionComentarioPost"("comentarioId", "miembroId");
