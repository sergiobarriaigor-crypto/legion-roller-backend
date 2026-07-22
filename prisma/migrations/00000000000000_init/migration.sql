-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Miembro" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "correo" TEXT NOT NULL,
    "fechaNacimiento" TIMESTAMP(3),
    "passwordHash" TEXT NOT NULL,
    "ciudad" TEXT,
    "rol" TEXT NOT NULL DEFAULT 'usuario',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoria" TEXT,
    "estadoTexto" TEXT,
    "estadoSetAt" TIMESTAMP(3),
    "fotoUrl" TEXT,
    "mejorDistanciaRuta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ultimaConexion" TIMESTAMP(3),

    CONSTRAINT "Miembro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuscripcionPush" (
    "id" SERIAL NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuscripcionPush_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudRegistro" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "correo" TEXT,
    "fechaNacimiento" TIMESTAMP(3),
    "fotoUrl" TEXT,
    "ciudad" TEXT,
    "passwordHash" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitudRegistro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UbicacionActiva" (
    "id" SERIAL NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "modo" TEXT NOT NULL DEFAULT 'patinando',
    "iniciadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UbicacionActiva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recorrido" (
    "id" SERIAL NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'libre',
    "distanciaKm" DOUBLE PRECISION NOT NULL,
    "duracionSeg" INTEGER NOT NULL,
    "puntos" TEXT NOT NULL,
    "favorito" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recorrido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsistenciaRodada" (
    "id" SERIAL NOT NULL,
    "publicacionId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "recorridoId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AsistenciaRodada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publicacion" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "fecha" TEXT,
    "hora" TEXT,
    "puntoEncuentro" TEXT,
    "puntoLat" DOUBLE PRECISION,
    "puntoLon" DOUBLE PRECISION,
    "tipoFinalizacion" TEXT,
    "puntoFinLat" DOUBLE PRECISION,
    "puntoFinLon" DOUBLE PRECISION,
    "distanciaMinimaKm" DOUBLE PRECISION,
    "cerrada" BOOLEAN NOT NULL DEFAULT false,
    "rsvp" BOOLEAN NOT NULL DEFAULT false,
    "duracionHoras" INTEGER,
    "activaEnMapa" BOOLEAN NOT NULL DEFAULT false,
    "fotos" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordatorioEnviado" BOOLEAN NOT NULL DEFAULT false,
    "tipoAsistenciaEvento" TEXT,
    "codigoAsistencia" TEXT,

    CONSTRAINT "Publicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsistenciaEvento" (
    "id" SERIAL NOT NULL,
    "publicacionId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AsistenciaEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RsvpRespuesta" (
    "id" SERIAL NOT NULL,
    "publicacionId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "estado" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RsvpRespuesta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" SERIAL NOT NULL,
    "autorId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "resena" TEXT NOT NULL,
    "ubicacion" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'foto',
    "fotos" TEXT,
    "videoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReaccionPost" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReaccionPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComentarioPost" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "respuestaAId" INTEGER,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComentarioPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReaccionComentarioPost" (
    "id" SERIAL NOT NULL,
    "comentarioId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReaccionComentarioPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Emprendedor" (
    "id" SERIAL NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "nombreNegocio" TEXT NOT NULL,
    "rubro" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "contacto" TEXT,
    "ubicacion" TEXT,
    "instagram" TEXT,
    "facebook" TEXT,
    "tiktok" TEXT,
    "fotos" TEXT,
    "aprobado" BOOLEAN NOT NULL DEFAULT false,
    "solicitadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Emprendedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReaccionEmprendedor" (
    "id" SERIAL NOT NULL,
    "emprendedorId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReaccionEmprendedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResenaEmprendedor" (
    "id" SERIAL NOT NULL,
    "emprendedorId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "respuestaAId" INTEGER,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResenaEmprendedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReaccionResenaEmprendedor" (
    "id" SERIAL NOT NULL,
    "resenaId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReaccionResenaEmprendedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnuncioEmprendedor" (
    "id" SERIAL NOT NULL,
    "emprendedorId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnuncioEmprendedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconocimientoRecibido" (
    "id" SERIAL NOT NULL,
    "deId" INTEGER NOT NULL,
    "paraId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconocimientoRecibido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MensajeChat" (
    "id" SERIAL NOT NULL,
    "sala" TEXT NOT NULL,
    "autorId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "referenciaTipo" TEXT,
    "referenciaId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respuestaAId" INTEGER,
    "reenviadoDeId" INTEGER,
    "adjuntoTipo" TEXT,
    "adjuntoUrl" TEXT,
    "adjuntoUbicacionNombre" TEXT,
    "adjuntoUbicacionLat" DOUBLE PRECISION,
    "adjuntoUbicacionLon" DOUBLE PRECISION,
    "adjuntoRutaDistanciaKm" DOUBLE PRECISION,
    "adjuntoRutaDuracionSeg" INTEGER,
    "adjuntoRutaPuntos" TEXT,

    CONSTRAINT "MensajeChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LecturaChat" (
    "id" SERIAL NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "sala" TEXT NOT NULL,
    "leidoHasta" TIMESTAMP(3) NOT NULL,
    "entregadoHasta" TIMESTAMP(3),

    CONSTRAINT "LecturaChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReaccionMensajeChat" (
    "id" SERIAL NOT NULL,
    "mensajeId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReaccionMensajeChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MensajeChatOculto" (
    "id" SERIAL NOT NULL,
    "mensajeId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MensajeChatOculto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Emergencia" (
    "id" SERIAL NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "requiereAmbulancia" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltaAt" TIMESTAMP(3),

    CONSTRAINT "Emergencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Historia" (
    "id" SERIAL NOT NULL,
    "autorId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "texto" TEXT,
    "textoEstilo" TEXT,
    "ubicacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Historia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MencionHistoria" (
    "id" SERIAL NOT NULL,
    "historiaId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "escala" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "aceptada" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MencionHistoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReaccionHistoria" (
    "id" SERIAL NOT NULL,
    "historiaId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReaccionHistoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComentarioHistoria" (
    "id" SERIAL NOT NULL,
    "historiaId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "respuestaAId" INTEGER,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComentarioHistoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcoHistoria" (
    "id" SERIAL NOT NULL,
    "historiaId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcoHistoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VistaHistoria" (
    "id" SERIAL NOT NULL,
    "historiaId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "vistaAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VistaHistoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiembroTecnica" (
    "id" SERIAL NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "tecnica" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiembroTecnica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotoGaleria" (
    "id" SERIAL NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotoGaleria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReaccionFotoGaleria" (
    "id" SERIAL NOT NULL,
    "fotoId" INTEGER NOT NULL,
    "miembroId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReaccionFotoGaleria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Miembro_telefono_key" ON "Miembro"("telefono");

-- CreateIndex
CREATE UNIQUE INDEX "Miembro_correo_key" ON "Miembro"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "SuscripcionPush_endpoint_key" ON "SuscripcionPush"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "SolicitudRegistro_telefono_key" ON "SolicitudRegistro"("telefono");

-- CreateIndex
CREATE UNIQUE INDEX "SolicitudRegistro_correo_key" ON "SolicitudRegistro"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "UbicacionActiva_miembroId_key" ON "UbicacionActiva"("miembroId");

-- CreateIndex
CREATE UNIQUE INDEX "AsistenciaRodada_recorridoId_key" ON "AsistenciaRodada"("recorridoId");

-- CreateIndex
CREATE UNIQUE INDEX "AsistenciaRodada_publicacionId_miembroId_key" ON "AsistenciaRodada"("publicacionId", "miembroId");

-- CreateIndex
CREATE UNIQUE INDEX "AsistenciaEvento_publicacionId_miembroId_key" ON "AsistenciaEvento"("publicacionId", "miembroId");

-- CreateIndex
CREATE UNIQUE INDEX "RsvpRespuesta_publicacionId_miembroId_key" ON "RsvpRespuesta"("publicacionId", "miembroId");

-- CreateIndex
CREATE UNIQUE INDEX "ReaccionPost_postId_miembroId_key" ON "ReaccionPost"("postId", "miembroId");

-- CreateIndex
CREATE INDEX "ComentarioPost_postId_idx" ON "ComentarioPost"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "ReaccionComentarioPost_comentarioId_miembroId_key" ON "ReaccionComentarioPost"("comentarioId", "miembroId");

-- CreateIndex
CREATE UNIQUE INDEX "Emprendedor_miembroId_key" ON "Emprendedor"("miembroId");

-- CreateIndex
CREATE UNIQUE INDEX "ReaccionEmprendedor_emprendedorId_miembroId_key" ON "ReaccionEmprendedor"("emprendedorId", "miembroId");

-- CreateIndex
CREATE INDEX "ResenaEmprendedor_emprendedorId_idx" ON "ResenaEmprendedor"("emprendedorId");

-- CreateIndex
CREATE UNIQUE INDEX "ReaccionResenaEmprendedor_resenaId_miembroId_key" ON "ReaccionResenaEmprendedor"("resenaId", "miembroId");

-- CreateIndex
CREATE INDEX "MensajeChat_sala_idx" ON "MensajeChat"("sala");

-- CreateIndex
CREATE UNIQUE INDEX "LecturaChat_miembroId_sala_key" ON "LecturaChat"("miembroId", "sala");

-- CreateIndex
CREATE UNIQUE INDEX "ReaccionMensajeChat_mensajeId_miembroId_key" ON "ReaccionMensajeChat"("mensajeId", "miembroId");

-- CreateIndex
CREATE UNIQUE INDEX "MensajeChatOculto_mensajeId_miembroId_key" ON "MensajeChatOculto"("mensajeId", "miembroId");

-- CreateIndex
CREATE INDEX "Historia_autorId_idx" ON "Historia"("autorId");

-- CreateIndex
CREATE UNIQUE INDEX "MencionHistoria_historiaId_miembroId_key" ON "MencionHistoria"("historiaId", "miembroId");

-- CreateIndex
CREATE UNIQUE INDEX "ReaccionHistoria_historiaId_miembroId_key" ON "ReaccionHistoria"("historiaId", "miembroId");

-- CreateIndex
CREATE INDEX "ComentarioHistoria_historiaId_idx" ON "ComentarioHistoria"("historiaId");

-- CreateIndex
CREATE INDEX "EcoHistoria_historiaId_idx" ON "EcoHistoria"("historiaId");

-- CreateIndex
CREATE UNIQUE INDEX "VistaHistoria_historiaId_miembroId_key" ON "VistaHistoria"("historiaId", "miembroId");

-- CreateIndex
CREATE UNIQUE INDEX "MiembroTecnica_miembroId_tecnica_key" ON "MiembroTecnica"("miembroId", "tecnica");

-- CreateIndex
CREATE INDEX "FotoGaleria_miembroId_idx" ON "FotoGaleria"("miembroId");

-- CreateIndex
CREATE UNIQUE INDEX "ReaccionFotoGaleria_fotoId_miembroId_key" ON "ReaccionFotoGaleria"("fotoId", "miembroId");

-- AddForeignKey
ALTER TABLE "SuscripcionPush" ADD CONSTRAINT "SuscripcionPush_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UbicacionActiva" ADD CONSTRAINT "UbicacionActiva_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recorrido" ADD CONSTRAINT "Recorrido_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsistenciaRodada" ADD CONSTRAINT "AsistenciaRodada_publicacionId_fkey" FOREIGN KEY ("publicacionId") REFERENCES "Publicacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsistenciaRodada" ADD CONSTRAINT "AsistenciaRodada_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsistenciaRodada" ADD CONSTRAINT "AsistenciaRodada_recorridoId_fkey" FOREIGN KEY ("recorridoId") REFERENCES "Recorrido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsistenciaEvento" ADD CONSTRAINT "AsistenciaEvento_publicacionId_fkey" FOREIGN KEY ("publicacionId") REFERENCES "Publicacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsistenciaEvento" ADD CONSTRAINT "AsistenciaEvento_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RsvpRespuesta" ADD CONSTRAINT "RsvpRespuesta_publicacionId_fkey" FOREIGN KEY ("publicacionId") REFERENCES "Publicacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RsvpRespuesta" ADD CONSTRAINT "RsvpRespuesta_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaccionPost" ADD CONSTRAINT "ReaccionPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaccionPost" ADD CONSTRAINT "ReaccionPost_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComentarioPost" ADD CONSTRAINT "ComentarioPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComentarioPost" ADD CONSTRAINT "ComentarioPost_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComentarioPost" ADD CONSTRAINT "ComentarioPost_respuestaAId_fkey" FOREIGN KEY ("respuestaAId") REFERENCES "ComentarioPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaccionComentarioPost" ADD CONSTRAINT "ReaccionComentarioPost_comentarioId_fkey" FOREIGN KEY ("comentarioId") REFERENCES "ComentarioPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaccionComentarioPost" ADD CONSTRAINT "ReaccionComentarioPost_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emprendedor" ADD CONSTRAINT "Emprendedor_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaccionEmprendedor" ADD CONSTRAINT "ReaccionEmprendedor_emprendedorId_fkey" FOREIGN KEY ("emprendedorId") REFERENCES "Emprendedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaccionEmprendedor" ADD CONSTRAINT "ReaccionEmprendedor_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResenaEmprendedor" ADD CONSTRAINT "ResenaEmprendedor_emprendedorId_fkey" FOREIGN KEY ("emprendedorId") REFERENCES "Emprendedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResenaEmprendedor" ADD CONSTRAINT "ResenaEmprendedor_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResenaEmprendedor" ADD CONSTRAINT "ResenaEmprendedor_respuestaAId_fkey" FOREIGN KEY ("respuestaAId") REFERENCES "ResenaEmprendedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaccionResenaEmprendedor" ADD CONSTRAINT "ReaccionResenaEmprendedor_resenaId_fkey" FOREIGN KEY ("resenaId") REFERENCES "ResenaEmprendedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaccionResenaEmprendedor" ADD CONSTRAINT "ReaccionResenaEmprendedor_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnuncioEmprendedor" ADD CONSTRAINT "AnuncioEmprendedor_emprendedorId_fkey" FOREIGN KEY ("emprendedorId") REFERENCES "Emprendedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconocimientoRecibido" ADD CONSTRAINT "ReconocimientoRecibido_deId_fkey" FOREIGN KEY ("deId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconocimientoRecibido" ADD CONSTRAINT "ReconocimientoRecibido_paraId_fkey" FOREIGN KEY ("paraId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensajeChat" ADD CONSTRAINT "MensajeChat_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensajeChat" ADD CONSTRAINT "MensajeChat_respuestaAId_fkey" FOREIGN KEY ("respuestaAId") REFERENCES "MensajeChat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensajeChat" ADD CONSTRAINT "MensajeChat_reenviadoDeId_fkey" FOREIGN KEY ("reenviadoDeId") REFERENCES "MensajeChat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LecturaChat" ADD CONSTRAINT "LecturaChat_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaccionMensajeChat" ADD CONSTRAINT "ReaccionMensajeChat_mensajeId_fkey" FOREIGN KEY ("mensajeId") REFERENCES "MensajeChat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaccionMensajeChat" ADD CONSTRAINT "ReaccionMensajeChat_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensajeChatOculto" ADD CONSTRAINT "MensajeChatOculto_mensajeId_fkey" FOREIGN KEY ("mensajeId") REFERENCES "MensajeChat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensajeChatOculto" ADD CONSTRAINT "MensajeChatOculto_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emergencia" ADD CONSTRAINT "Emergencia_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Historia" ADD CONSTRAINT "Historia_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MencionHistoria" ADD CONSTRAINT "MencionHistoria_historiaId_fkey" FOREIGN KEY ("historiaId") REFERENCES "Historia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MencionHistoria" ADD CONSTRAINT "MencionHistoria_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaccionHistoria" ADD CONSTRAINT "ReaccionHistoria_historiaId_fkey" FOREIGN KEY ("historiaId") REFERENCES "Historia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaccionHistoria" ADD CONSTRAINT "ReaccionHistoria_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComentarioHistoria" ADD CONSTRAINT "ComentarioHistoria_historiaId_fkey" FOREIGN KEY ("historiaId") REFERENCES "Historia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComentarioHistoria" ADD CONSTRAINT "ComentarioHistoria_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComentarioHistoria" ADD CONSTRAINT "ComentarioHistoria_respuestaAId_fkey" FOREIGN KEY ("respuestaAId") REFERENCES "ComentarioHistoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcoHistoria" ADD CONSTRAINT "EcoHistoria_historiaId_fkey" FOREIGN KEY ("historiaId") REFERENCES "Historia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcoHistoria" ADD CONSTRAINT "EcoHistoria_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VistaHistoria" ADD CONSTRAINT "VistaHistoria_historiaId_fkey" FOREIGN KEY ("historiaId") REFERENCES "Historia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VistaHistoria" ADD CONSTRAINT "VistaHistoria_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiembroTecnica" ADD CONSTRAINT "MiembroTecnica_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotoGaleria" ADD CONSTRAINT "FotoGaleria_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaccionFotoGaleria" ADD CONSTRAINT "ReaccionFotoGaleria_fotoId_fkey" FOREIGN KEY ("fotoId") REFERENCES "FotoGaleria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaccionFotoGaleria" ADD CONSTRAINT "ReaccionFotoGaleria_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "Miembro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
