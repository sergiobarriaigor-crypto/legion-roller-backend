import { Injectable } from '@nestjs/common';

// Presencia "en línea" del chat: se guarda solo en memoria (no en la base de
// datos, no hay booleano "online" persistido) — se deriva en caliente, igual
// que patinandoAhora() deriva la vigencia de UbicacionActiva comparando
// actualizadoEn. Un Set por miembro soporta varias pestañas/dispositivos
// conectados a la vez: solo queda "desconectado" cuando el set se vacía.
@Injectable()
export class ChatPresenceService {
  private conectados = new Map<number, Set<string>>();

  conectar(miembroId: number, socketId: string) {
    const set = this.conectados.get(miembroId) ?? new Set<string>();
    set.add(socketId);
    this.conectados.set(miembroId, set);
  }

  // Devuelve true solo si ese era el último socket de este miembro (es decir,
  // acaba de quedar desconectado del todo).
  desconectar(miembroId: number, socketId: string): boolean {
    const set = this.conectados.get(miembroId);
    if (!set) return false;
    set.delete(socketId);
    if (set.size === 0) {
      this.conectados.delete(miembroId);
      return true;
    }
    return false;
  }

  estaConectado(miembroId: number): boolean {
    return (this.conectados.get(miembroId)?.size ?? 0) > 0;
  }
}
