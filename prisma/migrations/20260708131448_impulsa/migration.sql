-- CreateTable
CREATE TABLE "Emprendedor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "miembroId" INTEGER NOT NULL,
    "nombreNegocio" TEXT NOT NULL,
    "rubro" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "contacto" TEXT NOT NULL,
    "ubicacion" TEXT,
    "instagram" TEXT,
    "facebook" TEXT,
    "tiktok" TEXT,
    "aprobado" BOOLEAN NOT NULL DEFAULT false,
    "solicitadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Emprendedor_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReaccionEmprendedor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "emprendedorId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReaccionEmprendedor_emprendedorId_fkey" FOREIGN KEY ("emprendedorId") REFERENCES "Emprendedor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReaccionEmprendedor_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResenaEmprendedor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "emprendedorId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResenaEmprendedor_emprendedorId_fkey" FOREIGN KEY ("emprendedorId") REFERENCES "Emprendedor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResenaEmprendedor_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Miembro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnuncioEmprendedor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "emprendedorId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnuncioEmprendedor_emprendedorId_fkey" FOREIGN KEY ("emprendedorId") REFERENCES "Emprendedor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Emprendedor_miembroId_key" ON "Emprendedor"("miembroId");

-- CreateIndex
CREATE UNIQUE INDEX "ReaccionEmprendedor_emprendedorId_miembroId_key" ON "ReaccionEmprendedor"("emprendedorId", "miembroId");
