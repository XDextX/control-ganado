// Datos, fechas y reglas del hato. Mismo formato que la versión de un solo archivo: los respaldos viejos siguen sirviendo.
export const KEY = 'ganado.v1';
export const GESTACION = 283, SECADO_ANTES = 60;

export const EVENTOS = {
  celo: 'Celo (ciclo)', monta: 'Monta / inseminación', prenez: 'Preñez confirmada', parto: 'Parto',
  aborto: 'Aborto / vacía', destete: 'Destete', secado: 'Secado', retiro: 'Retiro (baja/venta/muerte)',
} as const;
export type TipoEvento = keyof typeof EVENTOS;
export const MOTIVOS = ['Venta', 'Muerte', 'Baja (desecho)'];
export const CATEGORIAS = ['Vaca', 'Novilla / vaquilla', 'Ternera', 'Ternero', 'Novillo', 'Toro'];

export interface Evento { id: string; tipo: TipoEvento; fecha: string; nota: string; motivo?: string }
export interface Animal {
  arete: string; nombre: string; tipo: 'leche' | 'carne'; nac: string; finca: string;
  sexo: string; raza: string; categoria: string; notas: string; eventos: Evento[];
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

export const hoy = () => new Date().toISOString().slice(0, 10);
export const sumarDias = (f: string, n: number) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) };
export const diasHasta = (f: string, desde = hoy()) => Math.round((+new Date(f + 'T12:00:00Z') - +new Date(desde + 'T12:00:00Z')) / 864e5);
export const fmt = (f?: string) => f ? new Date(f + 'T12:00:00Z').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
export const edad = (nac: string, desde = hoy()) => {
  if (!nac) return '';
  const [y1, m1, d1] = nac.split('-').map(Number), [y2, m2, d2] = desde.split('-').map(Number);
  const m = (y2 - y1) * 12 + m2 - m1 - (d2 < d1 ? 1 : 0);
  return m < 12 ? m + ' meses' : Math.floor(m / 12) + (m < 24 ? ' año' : ' años') + (m % 12 ? ' ' + (m % 12) + ' m' : '');
};
export const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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
  }
  return n;
}
