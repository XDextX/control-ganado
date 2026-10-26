// Estado compartido de la app y navegación entre pantallas. Todo componente lee y cambia `est` y luego llama render().
import { h } from './jsx';
import { Animal, cargar, hoy } from './datos';
import { TipoReporte } from './reportes';
import { detenerCamara } from './qr';

export type Vista = 'lista' | 'reportes' | 'reporte' | 'animal' | 'qr' | 'escaner' | 'cambios';

export const est = {
  db: cargar(),
  vista: 'lista' as Vista,
  anterior: 'lista' as Vista,
  actual: null as Animal | null,
  filtro: { q: '', finca: '', verRet: false },
  pagina: 0, // página de la lista de animales (empieza en 0)
  repTipo: 'inventario' as TipoReporte,
  mes: hoy().slice(0, 7),
  qrModo: 'animal' as 'animal' | 'corral',
  areteNuevo: '',
  cambiosDias: 0, // 0 = hoy, 1 = desde ayer, 6 = últimos 7 días
};

// main.tsx registra cómo se pinta la app (así las pantallas no se importan entre sí en círculo).
let pintor = () => {};
export const alPintar = (f: () => void) => { pintor = f };
export const render = () => pintor();

export function ir(v: Vista) { detenerCamara(); if (v !== est.vista) est.anterior = est.vista; est.vista = v; render(); scrollTo(0, 0) }
export function abrir(arete: string | null) { est.actual = arete ? est.db.animales[arete] : null; ir('animal') }
export function volver() { est.actual = null; ir('lista') }
export function mostrarReporte(t: TipoReporte) { est.repTipo = t; ir('reporte') }

export function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  h('a', { href: url, download: nombre }).dispatchEvent(new MouseEvent('click'));
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Abre el menú de compartir del teléfono (donde aparece WhatsApp); en la computadora, descarga el archivo.
export const puedeCompartir = (f: File) => !!navigator.canShare?.({ files: [f] });
export async function compartir(file: File, titulo: string): Promise<'compartido' | 'cancelado' | 'descargado'> {
  if (!puedeCompartir(file)) { descargar(file, file.name); return 'descargado' }
  try { await navigator.share({ files: [file], title: titulo }); return 'compartido' }
  catch { return 'cancelado' }
}

// Mensaje grande que confirma que algo quedó guardado.
export function avisar(texto: string) {
  const el = <div class="aviso-ok" role="status">{texto}</div> as HTMLElement;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}
