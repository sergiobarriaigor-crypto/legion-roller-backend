import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MapaModule } from './mapa/mapa.module';
import { PublicacionesModule } from './publicaciones/publicaciones.module';
import { PostsModule } from './posts/posts.module';
import { EmprendedoresModule } from './emprendedores/emprendedores.module';
import { PerfilModule } from './perfil/perfil.module';
import { ChatModule } from './chat/chat.module';
import { EmergenciasModule } from './emergencias/emergencias.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    MapaModule,
    PublicacionesModule,
    PostsModule,
    EmprendedoresModule,
    PerfilModule,
    ChatModule,
    EmergenciasModule,
    UploadsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
