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

@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  @Post()
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => {
          const nombreUnico = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(
            file.originalname,
          )}`;
          cb(null, nombreUnico);
        },
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
  subir(@UploadedFile() archivo: Express.Multer.File, @Req() req: Request) {
    if (!archivo) {
      throw new BadRequestException('No se recibió ningún archivo');
    }
    const base = `${req.protocol}://${req.get('host')}`;
    return { url: `${base}/uploads/${archivo.filename}` };
  }
}
