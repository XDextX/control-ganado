// Comprimir y descomprimir con lo que ya trae el navegador: las copias y los QR pesan varias veces menos.
// Formato 'deflate' (zlib): lleva una suma de control, así un trozo cambiado o cortado no pasa como bueno.

// Teléfonos con navegador viejo (Safari antes de 16.4) no traen el compresor.
export class SinSoporte extends Error {}
const sinSoporte = (que: string) => new SinSoporte(`Este teléfono no puede ${que}. Actualice el navegador o el sistema del teléfono`);
export const puedeComprimir = () => typeof CompressionStream !== 'undefined';

export async function comprimir(texto: string) {
  if (!puedeComprimir()) throw sinSoporte('preparar códigos comprimidos');
  return new Uint8Array(await new Response(new Blob([texto]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
}

const TROZO = 4096;
// Descomprime de a trozos y se detiene en cuanto pasa de `max` bytes (unos KB dañados o hechos a propósito pueden inflarse a cientos de MB).
// Lanza RangeError si es demasiado grande, SinSoporte si el navegador no sabe, y Error si los datos están dañados.
export async function descomprimir(datos: Uint8Array, max: number, formato: CompressionFormat = 'deflate') {
  if (typeof DecompressionStream === 'undefined') throw sinSoporte('abrir datos comprimidos');
  const ds = new DecompressionStream(formato), w = ds.writable.getWriter(), lector = ds.readable.getReader(), trozos: Uint8Array[] = [];
  (async () => { for (let i = 0; i < datos.length; i += TROZO) await w.write(datos.subarray(i, i + TROZO)); await w.close() })().catch(() => { /* lo informa la lectura */ });
  for (let total = 0; ;) {
    const { done, value } = await lector.read().catch(() => { throw new Error('datos dañados') });
    if (done) break;
    if ((total += value.length) > max) { await lector.cancel().catch(() => {}); throw new RangeError('demasiado grande') }
    trozos.push(value);
  }
  return new Uint8Array(await new Blob(trozos).arrayBuffer());
}

// Texto que se puede mandar por mensaje o guardar en un .txt: base64 de lo comprimido.
export const aBase64 = (b: Uint8Array) => { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s) };
export const deBase64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

// Copia de seguridad: 'GANADO2:' + base64 del JSON comprimido. Las copias viejas (JSON a la vista) se siguen leyendo,
// y un teléfono sin compresor guarda el JSON a la vista.
export const PREFIJO_COPIA = 'GANADO2:';
export const copiaComprimida = async (json: string) => puedeComprimir() ? PREFIJO_COPIA + aBase64(await comprimir(json)) : json;
export async function leerCopia(texto: string, max: number) {
  const t = texto.trim();
  if (!t.startsWith(PREFIJO_COPIA)) return t;
  let bytes;
  try { bytes = deBase64(t.slice(PREFIJO_COPIA.length).replace(/\s/g, '')) } catch { throw new SyntaxError('copia cortada') }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(await descomprimir(bytes, max)) }
  catch (e) { throw e instanceof RangeError || e instanceof SinSoporte ? e : new SyntaxError('copia cortada') }
}
