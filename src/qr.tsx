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
      {partes.length > 1 && <p aria-live="polite" class="qr-parte">{titulo}</p>}
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
// Negro sobre blanco: máximo contraste para leer desde una pantalla; el color va solo en el del corral.
export const OPCIONES_QR = { errorCorrectionLevel: 'L', margin: 2, scale: 5 } as const;

// ---------- QR del corral (se imprime): solo lleva el arete, así que admite diseño ----------
// Corrección H (aguanta que se tape hasta un 30 %): el logo del centro tapa bastante menos.
const LOGO = 0.22; // lado del logo, en proporción al código
const esOjo = (n: number, x: number, y: number) => (x < 7 || x >= n - 7) && (y < 7 || y >= n - 7) && !(x >= n - 7 && y >= n - 7);
// Cuadritos del código, sin los de debajo del logo (true = oscuro).
export function modulosCorral(arete: string) {
  // Al menos versión 5 (37×37): en un código de 21×21 el logo se comería casi toda la corrección y no quedaría margen para barro o rayones.
  let q; try { q = QRCode.create(arete, { errorCorrectionLevel: 'H', version: 5 }) } catch { q = QRCode.create(arete, { errorCorrectionLevel: 'H' }) }
  const m = q.modules, n = m.size;
  const ini = Math.floor(n * (1 - LOGO) / 2), fin = n - ini;
  return { n, ini, fin, oscuro: (x: number, y: number) => !!m.get(y, x) && !(x >= ini && x < fin && y >= ini && y < fin) };
}

const VERDE = '#1f5f30';
export function QrCorral({ arete, nombre }: { arete: string; nombre: string }) {
  const img = <img alt={`Código QR del arete ${arete}`} class="qr-corral" /> as HTMLImageElement;
  const { n, ini, fin, oscuro } = modulosCorral(arete);
  // Las letras crecen con el código: impreso a 6 cm, el arete mide unos 6 mm y el nombre unos 4 mm.
  const px = 14, borde = 4 * px, lado = n * px + 2 * borde, alto = lado + Math.round(lado * 0.3), letraArete = Math.round(lado * 0.1), letraNombre = Math.round(lado * 0.065);
  const c = document.createElement('canvas'); c.width = lado; c.height = alto;
  const x = c.getContext('2d')!;
  // roundRect no existe en iOS 15: ahí van esquinas rectas.
  const redondo = (a: number, b: number, w: number, h: number, r: number) => { x.beginPath(); if (x.roundRect) x.roundRect(a, b, w, h, r); else x.rect(a, b, w, h); x.fill() };
  const dibujar = (logo?: HTMLImageElement) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, lado, alto);
    // Marco para recortar
    x.setLineDash([10, 8]); x.strokeStyle = '#888'; x.lineWidth = 2; x.strokeRect(4, 4, lado - 8, alto - 8); x.setLineDash([]);
    x.fillStyle = VERDE;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++)
      if (oscuro(i, j) && !esOjo(n, i, j)) { x.beginPath(); x.arc(borde + (i + .5) * px, borde + (j + .5) * px, px * .46, 0, 7); x.fill() }
    // Los tres «ojos» de las esquinas, redondeados pero llenos: la cámara se guía por ellos.
    for (const [i, j] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
      const a = borde + i * px, b = borde + j * px;
      redondo(a, b, 7 * px, 7 * px, 2 * px);
      x.fillStyle = '#fff'; redondo(a + px, b + px, 5 * px, 5 * px, 1.4 * px);
      x.fillStyle = VERDE; redondo(a + 2 * px, b + 2 * px, 3 * px, 3 * px, px);
    }
    if (logo) { const a = borde + ini * px, l = (fin - ini) * px; x.fillStyle = '#fff'; redondo(a, a, l, l, px); x.drawImage(logo, a + px * .6, a + px * .6, l - px * 1.2, l - px * 1.2) }
    x.fillStyle = '#1a1a1a'; x.textAlign = 'center';
    x.font = `bold ${letraArete}px system-ui, sans-serif`; x.fillText(arete, lado / 2, lado + letraArete * 0.6, lado - 40);
    if (nombre) { x.font = `${letraNombre}px system-ui, sans-serif`; x.fillText(nombre, lado / 2, lado + letraArete * 0.6 + letraNombre * 1.5, lado - 40) }
    img.src = c.toDataURL('image/png');
  };
  // Si algo falla con el logo (un navegador que no dibuja el SVG), la etiqueta sale igual, sin logo: nunca en blanco.
  const sinLogo = () => { try { dibujar() } catch { img.alt = `No se pudo dibujar el código del arete ${arete}` } };
  const logo = new Image(); logo.onload = () => { try { dibujar(logo) } catch { sinLogo() } }; logo.onerror = sinLogo; logo.src = 'icon.svg';
  return img;
}



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
