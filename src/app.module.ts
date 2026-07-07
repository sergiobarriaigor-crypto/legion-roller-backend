import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MapaModule } from './mapa/mapa.module';
import { PublicacionesModule } from './publicaciones/publicaciones.module';

@Module({
  imports: [PrismaModule, AuthModule, MapaModule, PublicacionesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
