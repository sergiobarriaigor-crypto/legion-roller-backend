import { promises as fs } from 'node:fs';
import { join } from 'node:path';

const PREFIJO_UPLOADS = '/uploads/';

// Convierte la URL pública (http://host/uploads/archivo.jpg) devuelta por
// UploadsController a la ruta real en disco, usando el mismo directorio
// ('uploads' bajo process.cwd()) que uploads.controller.ts y main.ts
// (useStaticAssets) ya usan para guardar/servir esos archivos. Compartida
// entre todos los módulos que borran registros con un archivo subido
// (chat, historias, posts, publicaciones, emprendedores, perfil).
export function rutaArchivoSubido(url: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  if (!pathname.startsWith(PREFIJO_UPLOADS)) return null;
  const nombreArchivo = pathname.slice(PREFIJO_UPLOADS.length);
  if (!nombreArchivo || nombreArchivo.includes('/')) return null;
  return join(process.cwd(), 'uploads', nombreArchivo);
}

// Borra el archivo si la URL apunta a /uploads/ (ignora silenciosamente si ya
// no existe, si la URL no es local, o si el borrado falla por cualquier
// motivo — nunca debe hacer fallar la eliminación del registro en BD).
export async function borrarArchivoSubido(
  url: string | null | undefined,
): Promise<void> {
  if (!url) return;
  const ruta = rutaArchivoSubido(url);
  if (!ruta) return;
  await fs.unlink(ruta).catch(() => {});
}
