// Estado compartido de la app y navegación entre pantallas. Todo componente lee y cambia `est` y luego llama render().
import { h } from './jsx';
import { Animal, cargar, datosDeEjemplo, guardar, hoy } from './datos';
import { TipoReporte } from './reportes';
import { detenerCamara } from './qr';

export type Vista = 'lista' | 'reportes' | 'reporte' | 'animal' | 'qr' | 'escaner' | 'cambios' | 'mover' | 'pesaje';

export const est = {
  db: cargar(),
  ejemplo: false, // viendo el hato inventado: nada se guarda y lo real sigue intacto
  vista: 'lista' as Vista,
  anterior: 'lista' as Vista,
  actual: null as Animal | null,
  filtro: { q: '', finca: '', verRet: false },
  pagina: 0, // página de la lista de animales (empieza en 0)
  repTipo: 'inventario' as TipoReporte,
  mes: hoy().slice(0, 7),
  qrModo: 'animal' as 'animal' | 'corral',
  nuevo: {} as Partial<Animal>, // valores iniciales para dar de alta (arete escaneado, datos de una cría)
  criaDe: '', // arete de la madre recién parida: ofrece agregar la cría
  fechaPesaje: '', // día que muestra el reporte de pesajes ('' = el último)
  cambiosDias: 0, // 0 = hoy, 1 = desde ayer, 6 = últimos 7 días
};

export function verEjemplo(si: boolean) { est.ejemplo = si; est.db = si ? datosDeEjemplo() : cargar(); volver() }

// main.tsx registra cómo se pinta la app (así las pantallas no se importan entre sí en círculo).
let pintor = () => {};
export const alPintar = (f: () => void) => { pintor = f };
export const render = () => pintor();

export function ir(v: Vista) {
  detenerCamara(); if (v !== est.vista) est.anterior = est.vista; est.vista = v; render(); scrollTo(0, 0);
  document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true }); // quien usa lector de pantalla empieza en la pantalla nueva
  // Fuera de la lista se deja un paso en el historial: así el botón "atrás" del teléfono vuelve en vez de cerrar la app.
  if (v !== 'lista' && !history.state?.app) history.pushState({ app: 1 }, '');
}
export function abrir(arete: string | null) { est.criaDe = ''; est.actual = arete ? est.db.animales[arete] : null; ir('animal') }
export function volver() { est.actual = null; ir('lista'); if (history.state?.app) history.back() }

// Botón "atrás" del teléfono: hace lo mismo que el "← Volver" de cada pantalla.
addEventListener('popstate', () => {
  if (est.vista === 'lista') return; // ya volvió con el botón de la pantalla
  if (est.vista === 'qr') return ir('animal');
  if (est.vista === 'reporte' && est.anterior !== 'lista') return ir(est.anterior);
  est.actual = null; ir('lista');
});
export function mostrarReporte(t: TipoReporte) { est.repTipo = t; ir('reporte') }

export function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  // En la página y con tiempo de sobra: algunos teléfonos ignoran el clic en un enlace suelto o tardan en leer el archivo.
  const a = h('a', { href: url, download: nombre, class: 'hide' }) as HTMLAnchorElement;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Abre el menú de compartir del teléfono (donde aparecen las apps de mensajería); en la computadora, descarga el archivo.
export const puedeCompartir = (f: File) => !!navigator.canShare?.({ files: [f] });
export async function compartir(file: File, titulo: string): Promise<'compartido' | 'cancelado' | 'descargado'> {
  if (!puedeCompartir(file)) { descargar(file, file.name); return 'descargado' }
  try { await navigator.share({ files: [file], title: titulo }); return 'compartido' }
  catch (e) {
    // Solo "cancelado" si la persona cerró el menú; si el teléfono no pudo compartir, se descarga para no perder la copia.
    if ((e as Error).name === 'AbortError') return 'cancelado';
    descargar(file, file.name); return 'descargado';
  }
}

// Guarda y lo dice en pantalla (las ventanitas del navegador pueden estar bloqueadas). Sin texto, solo avisa si falló.
export function guardarYAvisar(texto = '') {
  if (est.ejemplo || guardar(est.db)) { if (texto) avisar(texto); return true }
  document.querySelector('.aviso-mal')?.remove();
  const el = <div class="aviso-ok aviso-mal" role="alert" onClick={() => el.remove()}>⚠️ No se pudo guardar. Si cierra la app se perderá lo último. Envíe una copia de seguridad ahora. (Toque para cerrar)</div> as HTMLElement;
  document.body.appendChild(el);
  return false;
}

// Mensaje grande que confirma que algo quedó guardado.
export function avisar(texto: string) {
  const el = <div class="aviso-ok" role="status">{texto}</div> as HTMLElement;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}
