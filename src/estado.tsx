// Estado compartido de la app y navegación entre pantallas. Todo componente lee y cambia `est` y luego llama render().
import { h } from './jsx';
import { Animal, KEY, cargar, datosDeEjemplo, guardar, hoy } from './datos';
import { TipoReporte } from './reportes';
import type { Destino, Rango, Resultado } from './senasa';
import { detenerCamara } from './qr';

const REPORTES: TipoReporte[] = ['inventario', 'partos', 'salidas', 'traslados', 'pesajes', 'ficha'];

const VISTAS = ['lista', 'reportes', 'reporte', 'animal', 'qr', 'escaner', 'cambios', 'mover', 'pesaje', 'senasa'] as const;
export type Vista = typeof VISTAS[number];

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
  senasa: null as { rangos: Rango[]; destinos: Record<string, Destino>; resultado?: Resultado } | null, // Excel de SENASA leído, esperando que se confirme
  planilla: { finca: '', fecha: '', elegidaEl: '' }, // hoja de pesaje; elegidaEl: día en que se eligió la fecha (la app puede quedar abierta varios días)
};

export function verEjemplo(si: boolean) { est.ejemplo = si; est.db = si ? datosDeEjemplo() : cargar(); volver() }

// main.tsx registra cómo se pinta la app (así las pantallas no se importan entre sí en círculo).
let pintor = () => {};
export const alPintar = (f: () => void) => { pintor = f };
export const render = () => { pintor(); recordarPantalla() };

// Al recargar, volver a la misma pantalla. Se guarda por pestaña (sessionStorage): abrir la app de nuevo empieza en la lista.
const PANTALLA = KEY + '.pantalla';
function recordarPantalla() {
  const { vista, anterior, repTipo, mes, fechaPesaje, qrModo, planilla, ejemplo } = est;
  try { sessionStorage.setItem(PANTALLA, JSON.stringify({ vista, anterior, repTipo, mes, fechaPesaje, qrModo, planilla, ejemplo, arete: est.actual?.arete ?? null })) } catch { /* sin almacenamiento: empieza en la lista */ }
}
export function restaurarPantalla() {
  let p: any;
  try { p = JSON.parse(sessionStorage.getItem(PANTALLA) ?? 'null') } catch { return }
  // Lo guardado es de esta pestaña, pero puede venir de otra versión de la app: todo se comprueba antes de usarlo.
  const vista = (v: unknown): v is Vista => VISTAS.includes(v as Vista) && v !== 'escaner' && v !== 'senasa'; // la cámara no se enciende sola; el Excel leído no se guarda
  const texto = (v: unknown) => typeof v === 'string' ? v : '';
  const dia = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''; // una fecha mal escrita guardaría pesajes que luego se descartan
  if (!p || p.ejemplo || !vista(p.vista)) return; // el ejemplo no se guarda: al recargar se sale de él
  const actual = Object.hasOwn(est.db.animales, texto(p.arete)) ? est.db.animales[p.arete] : null;
  if (p.arete && !actual) return; // el animal ya no existe
  const repTipo = REPORTES.includes(p.repTipo) ? p.repTipo : est.repTipo;
  if (!actual && (p.vista === 'qr' || (p.vista === 'reporte' && repTipo === 'ficha'))) return; // pantallas que necesitan un animal
  const pl = p.planilla ?? {};
  Object.assign(est, {
    vista: p.vista, anterior: vista(p.anterior) ? p.anterior : 'lista', repTipo, actual,
    mes: /^\d{4}-\d{2}$/.test(p.mes) ? p.mes : est.mes, fechaPesaje: texto(p.fechaPesaje), qrModo: p.qrModo === 'corral' ? 'corral' : 'animal',
    planilla: { finca: texto(pl.finca), fecha: dia(pl.fecha), elegidaEl: dia(pl.fecha) && dia(pl.elegidaEl) },
  });
  if (est.vista !== 'lista' && !history.state?.app) history.pushState({ app: 1 }, '');
}

export function ir(v: Vista) {
  detenerCamara(); quitarError('otros'); if (v !== est.vista) est.anterior = est.vista; est.vista = v; render(); scrollTo(0, 0);
  document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true }); // quien usa lector de pantalla empieza en la pantalla nueva
  // Fuera de la lista se deja un paso en el historial: así el botón "atrás" del teléfono vuelve en vez de cerrar la app.
  if (v !== 'lista' && !history.state?.app) history.pushState({ app: 1 }, '');
}
export function abrir(arete: string | null) { est.criaDe = ''; est.actual = arete ? est.db.animales[arete] : null; ir('animal') }
export function volver() { est.actual = null; ir('lista'); if (history.state?.app) history.back() }

// Botón "atrás" del teléfono: hace lo mismo que el "← Volver" de cada pantalla.
addEventListener('popstate', () => {
  est.senasa = null; // el Excel leído solo sirve en su pantalla
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
  if (est.ejemplo || guardar(est.db)) {
    quitarError('guardado'); // volvió a guardar bien: el aviso de falla ya no aplica
    if (texto) avisar(texto);
    return true;
  }
  avisarError('No se guardó lo último. Envíe una copia de seguridad antes de cerrar la app.', { guardado: true });
  return false;
}

// Aviso rojo que se queda hasta tocarlo: para errores, en pantalla y no en una ventanita del navegador (algunas apps las bloquean).
// La caja anuncia el texto (role="alert") y dentro va un botón que lo cierra con un toque, Enter o espacio.
// guardado: el de "no se pudo guardar" no se quita al cambiar de pantalla, solo al tocarlo o cuando un guardado sale bien.
// foco: false cuando el foco ya está donde la persona tiene que escribir (por ejemplo, el campo que falta).
// Ningún aviso flota: todos son franjas al principio de la página, en #avisos, y empujan el contenido en vez de taparlo.
// Puede haber dos rojos a la vez: el de guardado (siempre primero) y el de otro error.
// Un error de un campo no va aquí: va debajo de ese campo (ver «Pegue aquí una copia» y la finca del Excel).
const franjas = () => document.getElementById('avisos') ?? document.body.insertAdjacentElement('afterbegin', <div id="avisos" /> as HTMLElement)!;
// Mientras la franja está pegada arriba, el teclado no debe dejar el foco escondido debajo de ella (su alto cambia con el texto y el ancho).
function ajustarFranja() {
  const f = document.getElementById('avisos');
  document.documentElement.style.scrollPaddingTop = f && getComputedStyle(f).position === 'sticky' ? f.offsetHeight + 'px' : '';
}
addEventListener('resize', ajustarFranja);
export function avisarError(texto: string, { guardado = false, foco = !guardado }: { guardado?: boolean; foco?: boolean } = {}) {
  quitarError(guardado ? 'guardado' : 'otros');
  const antes = document.activeElement as HTMLElement | null;
  const cerrar = () => {
    caja.remove(); ajustarFranja();
    // El foco vuelve a donde estaba; si ya no existe, a la pantalla.
    (antes?.isConnected && antes !== document.body ? antes : document.querySelector<HTMLElement>('main'))?.focus({ preventScroll: true });
  };
  const caja = <div class="aviso-mal" role="alert" data-guardado={guardado || undefined}>
    <span>⚠️ {texto}</span>
    <button type="button" onClick={cerrar}>✕ Cerrar</button>
  </div> as HTMLElement;
  if (guardado) franjas().prepend(caja); else franjas().appendChild(caja);
  ajustarFranja();
  // Con foco (por ejemplo, un archivo que no se pudo leer) la página sube hasta el aviso. El de guardado no se lleva el foco:
  // se anuncia igual (role="alert") y no hace saltar la página mientras se anota.
  if (foco) caja.querySelector('button')!.focus();
}
// Quita avisos rojos: los de otros errores (al cambiar de pantalla o leer bien un archivo), el de guardado, o todos.
// Si el aviso tenía el foco, el foco pasa a la pantalla en vez de perderse en <body>.
export function quitarError(cuales: 'otros' | 'guardado' | 'todos' = 'todos') {
  for (const el of document.querySelectorAll<HTMLElement>('.aviso-mal')) {
    const esGuardado = el.hasAttribute('data-guardado');
    if (cuales === 'otros' && esGuardado || cuales === 'guardado' && !esGuardado) continue;
    const teniaFoco = el.contains(document.activeElement);
    el.remove();
    if (teniaFoco) document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true });
  }
  ajustarFranja();
}

// Mensaje grande que confirma que algo quedó guardado.
// ms: más tiempo para un mensaje largo (por ejemplo, lo que trajo una copia recuperada).
// Es una franja más, debajo de los rojos; uno nuevo reemplaza al anterior, y se puede cerrar antes con un toque.
export function avisar(texto: string, ms = 2200) {
  document.querySelector('#avisos .aviso-ok')?.remove();
  const quitar = () => { el.remove(); ajustarFranja() };
  const el = <div class="aviso-ok" role="status"><span>{texto}</span><button type="button" onClick={quitar}>✕ Cerrar</button></div> as HTMLElement;
  franjas().appendChild(el); ajustarFranja();
  setTimeout(quitar, ms);
}
