// Códigos QR: pasar un animal de un teléfono a otro y abrir la ficha escaneando el QR del corral.
import { h } from './jsx';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { Animal, Db } from './datos';

// Un QR de animal lleva este prefijo; cualquier otro texto se toma como número de arete.
export const PREFIJO = 'GANADO1:';
export const qrDeAnimal = (a: Animal) => PREFIJO + JSON.stringify({ animales: { [a.arete]: a } } satisfies Db);

export type Lectura = { tipo: 'animal'; datos: unknown } | { tipo: 'arete'; arete: string };
export function interpretar(texto: string): Lectura {
  if (texto.startsWith(PREFIJO)) return { tipo: 'animal', datos: JSON.parse(texto.slice(PREFIJO.length)) };
  return { tipo: 'arete', arete: texto.trim() };
}

export function ImagenQr({ texto }: { texto: string }) {
  const img = <img alt="Código QR" style="width:100%;max-width:420px;display:block;margin:auto;image-rendering:pixelated" /> as HTMLImageElement;
  const aviso = <p class="bad"></p> as HTMLElement;
  QRCode.toDataURL(texto, { errorCorrectionLevel: 'L', margin: 2, width: 800 })
    .then(url => (img.src = url))
    .catch(() => (aviso.textContent = 'Este animal tiene demasiado historial para un solo código QR. Use “Exportar respaldo” y mándelo por WhatsApp.'));
  return <div>{img}{aviso}</div>;
}

let detener: (() => void) | null = null;
export const detenerCamara = () => detener?.();

export function Escaner({ alLeer }: { alLeer: (texto: string) => void }) {
  const video = <video playsinline muted style="width:100%;border-radius:10px;background:#000" /> as HTMLVideoElement;
  const msg = <p>Apunte la cámara al código QR y manténgala quieta.</p> as HTMLElement;
  const c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true })!;
  if (!navigator.mediaDevices?.getUserMedia) msg.textContent = 'Este teléfono o navegador no permite usar la cámara aquí.';
  else navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(stream => {
    let vivo = true;
    detener = () => { vivo = false; stream.getTracks().forEach(t => t.stop()); detener = null };
    video.srcObject = stream; video.play();
    const paso = () => {
      if (!vivo) return;
      if (!video.isConnected) return detenerCamara(); // salió de la pantalla sin escanear
      if (video.readyState >= 2) {
        const k = Math.min(1, 640 / video.videoWidth); // imagen reducida: suficiente para leer y más rápido
        c.width = video.videoWidth * k; c.height = video.videoHeight * k;
        x.drawImage(video, 0, 0, c.width, c.height);
        const r = jsQR(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
        if (r?.data) { detenerCamara(); return alLeer(r.data) }
      }
      requestAnimationFrame(paso);
    };
    paso();
  }).catch(() => (msg.textContent = 'No se pudo abrir la cámara. Revise que la app tenga permiso para usar la cámara.'));
  return <div>{video}{msg}</div>;
}
