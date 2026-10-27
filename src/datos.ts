// Datos, fechas y reglas del hato. Mismo formato que la versión de un solo archivo: los respaldos viejos siguen sirviendo.
export const KEY = 'ganado.v1';
export const GESTACION = 283, SECADO_ANTES = 60;

export const EVENTOS = {
  celo: 'Celo (ciclo)', monta: 'Monta / inseminación', prenez: 'Preñez confirmada', parto: 'Parto',
  aborto: 'Aborto / vacía', destete: 'Destete', secado: 'Secado', retiro: 'Retiro (baja/venta/muerte)', traslado: 'Traslado',
  pesaje: 'Pesaje de leche',
} as const;
export type TipoEvento = keyof typeof EVENTOS;
export const MOTIVOS = ['Venta', 'Muerte', 'Baja (desecho)'];
export const CATEGORIAS = ['Vaca', 'Novilla / vaquilla', 'Ternera', 'Ternero', 'Novillo', 'Toro'];

export interface Evento { id: string; tipo: TipoEvento; fecha: string; nota: string; motivo?: string; desde?: string; hacia?: string; am?: number; pm?: number } // am/pm: kilos de leche
export interface Animal {
  arete: string; nombre: string; tipo: 'leche' | 'carne'; nac: string; finca: string;
  sexo: string; raza: string; categoria: string; notas: string; eventos: Evento[];
  creado?: string; // fecha en que se dio de alta en este teléfono (los animales viejos no la tienen)
}
export interface Db { animales: Record<string, Animal> }
export const CAMPOS = ['arete', 'nombre', 'tipo', 'nac', 'finca', 'sexo', 'raza', 'categoria', 'notas'] as const;

export function cargar(): Db {
  try { return JSON.parse(localStorage.getItem(KEY)!) || { animales: {} } }
  catch { alert('No se pudieron leer los datos guardados. Importe un respaldo.'); return { animales: {} } }
}
export function guardar(db: Db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)) }
  catch (e) { alert('¡No se pudo guardar! Exporte un respaldo ahora. ' + (e as Error).message) }
}
export function ultimoRespaldo(): string | null { try { return localStorage.getItem(KEY + '.respaldo') } catch { return null } }
export function marcarRespaldo() { try { localStorage.setItem(KEY + '.respaldo', hoy()) } catch { /* sin almacenamiento */ } }

// Fecha local (no UTC): en Costa Rica, después de las 6 p. m. UTC ya sería "mañana".
export const fechaLocal = (d: Date) => new Date(+d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
export const hoy = () => fechaLocal(new Date());
export const sumarDias = (f: string, n: number) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) };
export const diasHasta = (f: string, desde = hoy()) => Math.round((+new Date(f + 'T12:00:00Z') - +new Date(desde + 'T12:00:00Z')) / 864e5);
export const fmt = (f?: string) => f ? new Date(f + 'T12:00:00Z').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
export const edad = (nac: string, desde = hoy()) => {
  if (!nac) return '';
  const [y1, m1, d1] = nac.split('-').map(Number), [y2, m2, d2] = desde.split('-').map(Number);
  const m = (y2 - y1) * 12 + m2 - m1 - (d2 < d1 ? 1 : 0);
  return m < 12 ? m + ' meses' : Math.floor(m / 12) + (m < 24 ? ' año' : ' años') + (m % 12 ? ' ' + (m % 12) + ' m' : '');
};
// Acepta "borrar", "Borrar.", " BORRAR " o "Bórrar": el autocorrector del teléfono suele agregar puntos o tildes.
export const diceBorrar = (t: string) => t.normalize('NFD').toUpperCase().replace(/[^A-Z]/g, '') === 'BORRAR';
export const cuantos =(n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
export const nuevoId =() => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const porArete = (x: Animal, y: Animal) => x.arete.localeCompare(y.arete, 'es', { numeric: true });
export const nombreA = (a: Animal) => a.arete + (a.nombre ? ' ' + a.nombre : '');
export const ordenados = (a: Animal) => [...a.eventos].sort((x, y) => x.fecha.localeCompare(y.fecha) || x.id.localeCompare(y.id));
export const retiro = (a: Animal) => a.eventos.find(e => e.tipo === 'retiro');
export const fincas = (db: Db) => [...new Set(Object.values(db.animales).map(a => a.finca).filter(Boolean))].sort();

// Gestación abierta: última monta/preñez sin parto ni aborto posterior. Fecha base = la monta más reciente antes de esa preñez.
export function prenezAbierta(a: Animal) {
  let base: string | null = null;
  for (const e of ordenados(a)) {
    if (e.tipo === 'monta') base = e.fecha;
    else if (e.tipo === 'prenez' && !base) base = e.fecha;
    else if (e.tipo === 'parto' || e.tipo === 'aborto') base = null;
  }
  if (!base) return null;
  const parto = sumarDias(base, GESTACION);
  return { parto, secado: a.tipo === 'leche' ? sumarDias(parto, -SECADO_ANTES) : null };
}

export function alertas(db: Db, desde = hoy()) {
  const out: { a: Animal; que: string; f: string }[] = [];
  for (const a of Object.values(db.animales)) {
    if (retiro(a)) continue;
    const p = prenezAbierta(a); if (!p) continue;
    const yaSeco = a.eventos.some(e => e.tipo === 'secado' && e.fecha >= sumarDias(p.parto, -GESTACION));
    if (p.secado && !yaSeco) out.push({ a, que: 'Secar', f: p.secado });
    out.push({ a, que: 'Parto probable', f: p.parto });
  }
  return out.filter(x => diasHasta(x.f, desde) <= 30).sort((x, y) => x.f.localeCompare(y.f));
}

// Mueve el animal a otra finca y deja el traslado en su historial.
export function trasladar(a: Animal, hacia: string, fecha: string, nota = '') {
  a.eventos.push({ id: nuevoId(), tipo: 'traslado', fecha, nota, desde: a.finca, hacia });
  a.finca = hacia;
}
// La finca actual es la del traslado más reciente (si hubo alguno).
const fincaPorTraslados = (a: Animal) => ordenados(a).filter(e => e.tipo === 'traslado' && e.hacia).pop()?.hacia;

// ---------- Pesajes de leche (kilos, ordeño de mañana y de tarde) ----------
export const MAX_KILOS = 60; // por ordeño: más que esto casi seguro es un error al escribir

// Vacas de leche que se pesan: hembras activas, vacas o sin categoría. "Seca" si el último secado es después del último parto.
export function vacasDeLeche(db: Db, finca: string) {
  return Object.values(db.animales)
    .filter(a => a.tipo === 'leche' && a.sexo !== 'M' && !retiro(a) && a.finca === finca && (!a.categoria || a.categoria === 'Vaca'))
    .sort(porArete)
    .map(a => ({ a, seca: estaSeca(a) }));
}
const ultimo = (a: Animal, t: TipoEvento) => ordenados(a).filter(e => e.tipo === t).pop();
export const estaSeca = (a: Animal) => a.tipo === 'leche' && (ultimo(a, 'secado')?.fecha ?? '') > (ultimo(a, 'parto')?.fecha ?? '');
export const ultimoPesaje = (a: Animal) => ultimo(a, 'pesaje');
// Cómo se nombra un evento en pantalla.
export const textoEvento = (e: Evento) => e.tipo === 'retiro' ? 'Salida: ' + e.motivo
  : e.tipo === 'traslado' ? `Traslado: ${e.desde || '—'} → ${e.hacia}`
  : e.tipo === 'pesaje' ? `Pesaje: ${kilos(totalPesaje(e))}` : EVENTOS[e.tipo];
// Último evento de manejo (los pesajes van aparte).
export const ultimoEvento = (a: Animal) => ordenados(a).filter(e => e.tipo !== 'pesaje').pop();
// "hoy", "ayer", "hace 5 días", "en 3 días".
export const haceCuanto = (fecha: string, desde = hoy()) => {
  const d = -diasHasta(fecha, desde);
  return d === 0 ? 'hoy' : d === 1 ? 'ayer' : d > 0 ? `hace ${cuantos(d, 'día', 'días')}` : `en ${cuantos(-d, 'día', 'días')}`;
};
// Si por una copia de otro teléfono quedaron dos pesajes del mismo día, vale el último anotado.
export const pesajeDe = (a: Animal, fecha: string) => ordenados(a).filter(e => e.tipo === 'pesaje' && e.fecha === fecha).pop();
export const pesajeAnterior = (a: Animal, fecha: string) => ordenados(a).filter(e => e.tipo === 'pesaje' && e.fecha < fecha).pop();
// Un ordeño que da más del doble o menos de la mitad que la vez pasada casi siempre es un error al escribir (51 en vez de 15).
export const esRaro = (n: number | undefined, antes: number | undefined) => !!n && !!antes && (n > antes * 2 || n < antes / 2);
export const totalPesaje =(e: Evento) => (e.am ?? 0) + (e.pm ?? 0);
export const kilos = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 }) + ' kg';

// Lee lo que se escribe en el cuadro: acepta coma o punto. '' = no se pesó. NaN = no es un número válido.
export function leerKilos(t: string): number | undefined {
  t = t.trim().replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return n >= 0 && n <= MAX_KILOS ? Math.round(n * 10) / 10 : NaN;
}

// Guarda los pesajes de un día. Si la vaca ya tenía pesaje esa fecha, se reemplaza (para poder corregir).
export function guardarPesajes(db: Db, fecha: string, valores: { arete: string; am?: number; pm?: number }[]) {
  let n = 0;
  for (const v of valores) {
    const a = db.animales[v.arete];
    if (!a) continue;
    a.eventos = a.eventos.filter(e => !(e.tipo === 'pesaje' && e.fecha === fecha));
    if (v.am === undefined && v.pm === undefined) continue;
    a.eventos.push({ id: nuevoId(), tipo: 'pesaje', fecha, nota: '', am: v.am, pm: v.pm });
    n++;
  }
  return n;
}

// El id de cada evento empieza con la hora en que se anotó (ver nuevoId): de ahí sale el día en que se registró.
export const anotadoEl = (e: Evento) => { const t = parseInt(e.id.slice(0, -4), 36); return isNaN(t) ? '' : fechaLocal(new Date(t)) };

// Lo anotado desde una fecha: animales dados de alta y eventos registrados ese día o después, sin campos vacíos (para que quepa en un QR).
// shortcut: los cambios a los datos de un animal ya existente (nombre, finca…) no viajan; para eso está la copia completa.
export function cambiosDesde(db: Db, desde: string): Db {
  const animales: Db['animales'] = {};
  for (const a of Object.values(db.animales)) {
    const eventos = a.eventos.filter(e => anotadoEl(e) >= desde);
    if (!eventos.length && !(a.creado && a.creado >= desde)) continue;
    const limpio = Object.fromEntries(Object.entries(a).filter(([, v]) => v !== '' && v != null)) as unknown as Animal;
    animales[a.arete] = { ...limpio, eventos };
  }
  return { animales };
}

// Fusiona sin borrar: animales nuevos se agregan, eventos se unen por id. Los datos locales del animal ganan.
// shortcut: un evento borrado reaparece si otro respaldo aún lo tiene; añadir "borrados" si estorba.
export function fusionar(dst: Db, src: unknown) {
  const s = src as Db;
  if (!s || typeof s.animales !== 'object') throw new Error('no es un respaldo de ganado');
  const n = { animales: 0, eventos: 0 };
  for (const [k, a] of Object.entries(s.animales)) {
    if (!a || !Array.isArray(a.eventos) || typeof a.arete !== 'string') throw new Error('animal mal formado: ' + k);
    const loc = dst.animales[a.arete];
    if (!loc) { dst.animales[a.arete] = a; n.animales++; n.eventos += a.eventos.length; continue }
    const ids = new Set(loc.eventos.map(x => x.id));
    for (const ev of a.eventos) if (!ids.has(ev.id)) { loc.eventos.push(ev); n.eventos++ }
    // Un traslado anotado en otro teléfono también cambia la finca aquí.
    loc.finca = fincaPorTraslados(loc) ?? loc.finca;
  }
  return n;
}
