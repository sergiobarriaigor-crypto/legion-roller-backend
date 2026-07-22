import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
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
import { HistoriasModule } from './historias/historias.module';
import { NotificacionesPushModule } from './notificaciones-push/notificaciones-push.module';
import { ClimaModule } from './clima/clima.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
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
    HistoriasModule,
    NotificacionesPushModule,
    ClimaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
