import { Injectable } from '@nestjs/common';

const MINUTOS_VIGENCIA_CODIGO = 10;

interface EstadoVerificacion {
  codigo: string;
  expiraEn: number;
  verificado: boolean;
}

// Verificación de correo simulada: no hay proveedor de envío de correos
// configurado en este proyecto (sin SMTP/API key), así que el "envío" es
// solo un código guardado en memoria (mismo criterio que ChatPresenceService
// para estado efímero, sin tabla nueva en la base) que se devuelve igual en
// la respuesta del endpoint y se loguea por consola — para poder probar el
// flujo completo sin depender de un servicio externo. El día que se conecte
// un proveedor real, basta con dejar de incluir `codigo` en la respuesta de
// `generarCodigo` y realmente enviarlo por correo ahí mismo.
@Injectable()
export class VerificacionCorreoService {
  private estados = new Map<string, EstadoVerificacion>();

  generarCodigo(correo: string): string {
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    this.estados.set(correo, {
      codigo,
      expiraEn: Date.now() + MINUTOS_VIGENCIA_CODIGO * 60 * 1000,
      verificado: false,
    });

    console.log(
      `[verificación de correo simulada] ${correo} -> código ${codigo}`,
    );
    return codigo;
  }

  confirmarCodigo(
    correo: string,
    codigo: string,
  ): { ok: true } | { ok: false; error: string } {
    const estado = this.estados.get(correo);
    if (!estado) {
      return { ok: false, error: 'Primero pide un código para este correo.' };
    }
    if (Date.now() > estado.expiraEn) {
      return { ok: false, error: 'El código expiró, pide uno nuevo.' };
    }
    if (estado.codigo !== codigo) {
      return { ok: false, error: 'Código incorrecto.' };
    }
    estado.verificado = true;
    return { ok: true };
  }

  estaVerificado(correo: string): boolean {
    return this.estados.get(correo)?.verificado ?? false;
  }
}
