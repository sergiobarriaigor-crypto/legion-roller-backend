import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'node:path';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const nombrarArchivo = (
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, filename: string) => void,
) => {
  const nombreUnico = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(
    file.originalname,
  )}`;
  cb(null, nombreUnico);
};

@Controller('uploads')
export class UploadsController {
  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: diskStorage({
        destination: './uploads',
        filename: nombrarArchivo,
      }),
      fileFilter: (_req, file, cb) => {
        if (
          !file.mimetype.startsWith('image/') &&
          !file.mimetype.startsWith('video/')
        ) {
          cb(
            new BadRequestException('Solo se permiten imágenes o videos'),
            false,
          );
          return;
        }
        cb(null, true);
      },
      // Antes 5MB (solo imágenes). Historias sube videos cortos (máx. 30s), así que
      // el límite subió a 40MB para que quepan sin afectar las imágenes (siguen pesando poco).
      limits: { fileSize: 40 * 1024 * 1024 },
    }),
  )
  subir(@UploadedFile() archivo: Express.Multer.File, @Req() req: Request) {
    if (!archivo) {
      throw new BadRequestException('No se recibió ningún archivo');
    }
    const base = `${req.protocol}://${req.get('host')}`;
    return { url: `${base}/uploads/${archivo.filename}` };
  }

  // Sin JwtAuthGuard: la foto de perfil del formulario de registro se sube
  // antes de tener token (el usuario aún no inicia sesión). Solo imágenes y
  // un límite bajo (5MB, ya viene comprimida a .webp 260x260 desde el
  // recorte circular) para no abrir una puerta de subida arbitraria.
  @Post('registro')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: diskStorage({
        destination: './uploads',
        filename: nombrarArchivo,
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Solo se permiten imágenes'), false);
          return;
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  subirRegistro(
    @UploadedFile() archivo: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!archivo) {
      throw new BadRequestException('No se recibió ningún archivo');
    }
    const base = `${req.protocol}://${req.get('host')}`;
    return { url: `${base}/uploads/${archivo.filename}` };
  }
}
