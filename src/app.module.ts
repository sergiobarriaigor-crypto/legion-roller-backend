import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MapaModule } from './mapa/mapa.module';
import { PublicacionesModule } from './publicaciones/publicaciones.module';
import { PostsModule } from './posts/posts.module';
import { EmprendedoresModule } from './emprendedores/emprendedores.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    MapaModule,
    PublicacionesModule,
    PostsModule,
    EmprendedoresModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
