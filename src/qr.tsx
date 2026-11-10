// Códigos QR: pasar un animal de un teléfono a otro y abrir la ficha escaneando el QR del corral.
import { h } from './jsx';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { Db } from './datos';
import { SinSoporte, comprimir, descomprimir } from './comprimir';

// Los QR viejos llevaban este prefijo y el JSON a la vista; se siguen leyendo. Cualquier otro texto se toma como número de arete.
export const PREFIJO = 'GANADO1:';

export type Lectura = { tipo: 'animal'; datos: unknown } | { tipo: 'arete'; arete: string };
export function interpretar(texto: string): Lectura {
  if (texto.startsWith(PREFIJO)) return { tipo: 'animal', datos: JSON.parse(texto.slice(PREFIJO.length)) };
  return { tipo: 'arete', arete: texto.trim() };
}

// QR nuevos: los datos comprimidos, en binario, repartidos en hasta MAX_PARTES códigos.
// Cada parte: 'GN2', 2 bytes que identifican el envío, número de parte, total de partes y su trozo.
const MARCA = [71, 78, 50], CABECERA = 7, POR_QR = 2900; // un QR (nivel L) lleva hasta 2953 bytes
export const MAX_PARTES = 5; // palabras del dueño: más códigos que esto, mejor mandar la copia por mensaje
const MAX_RECIBIDO = 20 * 2 ** 20;
export type Parte = { id: number; i: number; n: number; trozo: Uint8Array };

// El id sale de los propios datos: el mismo envío da siempre los mismos códigos.
const idDe = (z: Uint8Array) => { let h = 2166136261; for (const x of z) h = Math.imul(h ^ x, 16777619); return (h >>> 0) & 0xffff };
export async function partesQr(d: Db) {
  const z = await comprimir(JSON.stringify(d)), n = Math.max(1, Math.ceil(z.length / (POR_QR - CABECERA))), largo = Math.ceil(z.length / n), id = idDe(z);
  return Array.from({ length: n }, (_, i) => Uint8Array.of(...MARCA, id >> 8, id & 255, i + 1, n, ...z.subarray(i * largo, (i + 1) * largo)));
}
export function leerParte(b: ArrayLike<number>): Parte | null {
  if (b.length <= CABECERA || MARCA.some((m, k) => b[k] !== m)) return null;
  const i = b[5], n = b[6];
  return i >= 1 && i <= n && n <= MAX_PARTES ? { id: b[3] * 256 + b[4], i, n, trozo: Uint8Array.from(Array.prototype.slice.call(b, CABECERA)) } : null;
}

// Recepción de un envío en varios códigos, en cualquier orden. Un envío a medias de hace más de 10 minutos se olvida.
export type Envio = { id: number; trozos: (Uint8Array | undefined)[]; cuando: number };
const VIGENCIA = 10 * 60 * 1000;
export const vigente = (e: Envio | null, ahora = Date.now()) => e && ahora - e.cuando < VIGENCIA ? e : null;
// Devuelve el envío con la parte sumada y si la parte era nueva.
export function sumarParte(e: Envio | null, p: Parte, ahora = Date.now()): { envio: Envio; nueva: boolean } {
  const v = vigente(e, ahora);
  const envio = v && v.id === p.id && v.trozos.length === p.n ? v : { id: p.id, trozos: Array(p.n).fill(undefined), cuando: ahora };
  const nueva = !envio.trozos[p.i - 1];
  if (nueva) { envio.trozos[p.i - 1] = p.trozo; envio.cuando = ahora }
  return { envio, nueva };
}
export const faltan = (e: Envio | null) => e ? e.trozos.flatMap((t, i) => t ? [] : [i + 1]) : [];

// Las partes en orden (1..n) a los datos; lanza si están dañadas (la suma de control de zlib lo detecta).
export async function juntarPartes(trozos: Uint8Array[]): Promise<unknown> {
  const todo = new Uint8Array(await new Blob(trozos).arrayBuffer());
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await descomprimir(todo, MAX_RECIBIDO)));
}

const AYUDA_VIEJA = 'Si el otro teléfono dice que el código no es de la app, que abra la app con internet para que se actualice, y vuelva a escanear.';

// QR de datos (un animal o lo anotado): uno o varios códigos, con Anterior/Siguiente.
export function QrDeDatos({ datos }: { datos: Db }) {
  const caja = <div><p class="mut">Preparando el código…</p></div> as HTMLElement;
  partesQr(datos).then(partes => {
    if (partes.length > MAX_PARTES) return caja.replaceChildren(<p class="bad">Son demasiados datos para pasarlos con códigos QR. Use “⚙️ Copia de seguridad → 📲 Enviar una copia” y mándela por mensaje.</p>);
    let i = 0;
    const titulo = <b></b> as HTMLElement, imagen = <div></div> as HTMLElement;
    let ant!: HTMLButtonElement, sig!: HTMLButtonElement;
    // Solo cambian la imagen y el texto: los botones quedan y el foco no se pierde.
    const mostrar = (paso: number) => {
      i += paso;
      titulo.textContent = `Código ${i + 1} de ${partes.length}`;
      imagen.replaceChildren(<ImagenQr texto={[{ data: partes[i], mode: 'byte' }]} />);
      if (!ant) return;
      const enfocado = document.activeElement; // antes de deshabilitar: un botón deshabilitado suelta el foco
      ant.disabled = i === 0; sig.disabled = i === partes.length - 1;
      if (enfocado === ant && ant.disabled) sig.focus();
      if (enfocado === sig && sig.disabled) ant.focus();
    };
    caja.replaceChildren(<div>
      {partes.length > 1 && <p aria-live="polite">{titulo}</p>}
      {imagen}
      {partes.length > 1 && <div class="paginas">
        <button class="grande" ref={(el: HTMLButtonElement) => (ant = el)} onClick={() => mostrar(-1)}>← Anterior</button>
        <button class="grande" ref={(el: HTMLButtonElement) => (sig = el)} onClick={() => mostrar(1)}>Siguiente →</button>
      </div>}
      {partes.length > 1 && <p class="ayuda">El otro teléfono tiene que escanear los {partes.length} códigos, en cualquier orden.</p>}
      <p class="ayuda">{AYUDA_VIEJA}</p>
    </div>);
    mostrar(0);
  }).catch(e => caja.replaceChildren(<p class="bad">{e instanceof SinSoporte ? e.message + '. ' : 'No se pudo preparar el código QR en este teléfono. '}Use “⚙️ Copia de seguridad” y mándela por mensaje.</p>));
  return caja;
}

// Píxeles enteros por cuadrito (scale, no width): con 4,5 px los cuadritos salían de 4 y 5 y la cámara no leía los códigos densos.
export const OPCIONES_QR = { errorCorrectionLevel: 'L', margin: 2, scale: 5 } as const;

export function ImagenQr({ texto }: { texto: string | QRCode.QRCodeSegment[] }) {
  const img = <img alt="Código QR" style="width:100%;max-width:420px;display:block;margin:auto;image-rendering:pixelated" /> as HTMLImageElement;
  const aviso = <p class="bad"></p> as HTMLElement;
  QRCode.toDataURL(texto, OPCIONES_QR)
    .then(url => (img.src = url))
    .catch(() => (aviso.textContent = 'Hay demasiados datos para un solo código QR. Use “⚙️ Copia de seguridad → 💾 Guardar una copia” y mándela por mensaje.'));
  return <div>{img}{aviso}</div>;
}

let detener: (() => void) | null = null;
export const detenerCamara = () => detener?.();

// alLeer recibe el texto y los bytes del código; la cámara sigue encendida hasta que alguien llame a detenerCamara (o cambie de pantalla).
export function Escaner({ alLeer, reintentar }: { alLeer: (texto: string, bytes: number[]) => void; reintentar: () => void }) {
  const video = <video playsinline muted style="width:100%;border-radius:10px;background:#000" /> as HTMLVideoElement;
  const msg = <p>Apunte la cámara al código QR y manténgala quieta.</p> as HTMLElement;
  const sinPermiso = () => {
    video.remove();
    msg.replaceChildren(<div class="card warn">
      <p><b>No se pudo abrir la cámara.</b> El teléfono necesita su permiso. Así se da:</p>
      <ol>
        <li>Arriba, junto a la dirección, toque el candado 🔒 o los tres puntitos.</li>
        <li>Entre a <b>Permisos</b> o <b>Configuración del sitio</b>.</li>
        <li>En <b>Cámara</b>, elija <b>Permitir</b>.</li>
      </ol>
      <button class="pri grande" onClick={reintentar}>🔄 Intentar de nuevo</button>
    </div>);
  };
  const c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true })!;
  if (!navigator.mediaDevices?.getUserMedia) msg.textContent = 'Este teléfono o navegador no permite usar la cámara aquí.';
  // Con más resolución se leen los códigos densos de varias partes.
  else navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } }).then(stream => {
    let vivo = true;
    // Si cambia de app o apaga la pantalla, la cámara se apaga (no queda filmando en segundo plano).
    const alOcultar = () => {
      if (!document.hidden) return;
      detenerCamara(); video.remove();
      msg.replaceChildren(<div class="card"><p>La cámara se apagó al salir de la app.</p>
        <button class="pri grande" onClick={reintentar}>📷 Encender la cámara otra vez</button></div>);
    };
    document.addEventListener('visibilitychange', alOcultar);
    detener = () => { vivo = false; stream.getTracks().forEach(t => t.stop()); document.removeEventListener('visibilitychange', alOcultar); detener = null };
    video.srcObject = stream; video.play();
    let fino = false;
    const paso = () => {
      if (!vivo) return;
      if (!video.isConnected) return detenerCamara(); // salió de la pantalla sin escanear
      if (video.readyState >= 2) {
        // Imagen reducida, más rápida; si no encuentra nada, la próxima vez mira a 1280 px (los códigos densos de varias partes).
        const k = Math.min(1, (fino ? 1280 : 640) / video.videoWidth);
        c.width = video.videoWidth * k; c.height = video.videoHeight * k;
        x.drawImage(video, 0, 0, c.width, c.height);
        const r = jsQR(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: fino ? 'dontInvert' : 'attemptBoth' }); // a 1280 px, sin probar invertido: no traba teléfonos baratos
        if (r && (r.data || r.binaryData.length)) alLeer(r.data, r.binaryData);
        fino = !r && !fino;
      }
      requestAnimationFrame(paso);
    };
    paso();
  }).catch(sinPermiso);
  return <div>{video}{msg}</div>;
}
