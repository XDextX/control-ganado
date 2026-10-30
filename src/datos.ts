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

// ---------- Validación de lo que entra (copias, QR y lo guardado) ----------
// Un dato dañado o malicioso no debe poder romper la app: lo que no tiene forma válida se descarta.
const RESERVADOS = new Set(['__proto__', 'constructor', 'prototype']);
export const areteValido = (s: unknown): s is string => typeof s === 'string' && !!s.trim() && s.trim().length <= 40 && !RESERVADOS.has(s.trim());
const esFecha = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const texto = (v: unknown, max: number) => typeof v === 'string' ? v.slice(0, max) : '';
const kilosValidos = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_KILOS ? v : undefined;

// Campos que venían con algo y quedaron distintos: texto recortado, tipo raro o kilos imposibles.
const perdidos = (o: any, l: any, campos: string[]) => campos.filter(k => o[k] != null && o[k] !== l[k]).length;

export function limpiarEvento(e: any): Evento | null {
  if (!e || typeof e !== 'object' || typeof e.id !== 'string' || !e.id || !Object.hasOwn(EVENTOS, e.tipo) || !esFecha(e.fecha)) return null;
  const ev: Evento = { id: e.id.slice(0, 40), tipo: e.tipo, fecha: e.fecha, nota: texto(e.nota, 500) };
  if (e.motivo != null) ev.motivo = texto(e.motivo, 60);
  if (e.desde != null) ev.desde = texto(e.desde, 80);
  if (e.hacia != null) ev.hacia = texto(e.hacia, 80);
  if (e.am != null) ev.am = kilosValidos(e.am);
  if (e.pm != null) ev.pm = kilosValidos(e.pm);
  return ev;
}

export function limpiarAnimal(a: any): { animal: Animal; descartados: number } | null {
  if (!a || typeof a !== 'object' || !areteValido(a.arete) || !Array.isArray(a.eventos)) return null;
  let cortados = 0;
  const eventos = a.eventos.flatMap((o: any) => { const e = limpiarEvento(o); if (!e) return []; cortados += perdidos(o, e, ['nota', 'motivo', 'desde', 'hacia', 'am', 'pm']); return [e] });
  const animal: Animal = {
    arete: a.arete.trim(), nombre: texto(a.nombre, 80), tipo: a.tipo === 'carne' ? 'carne' : 'leche', nac: esFecha(a.nac) ? a.nac : '',
    finca: texto(a.finca, 80), sexo: a.sexo === 'M' ? 'M' : 'H', raza: texto(a.raza, 80), categoria: texto(a.categoria, 40),
    notas: texto(a.notas, 1000), eventos,
  };
  if (esFecha(a.creado)) animal.creado = a.creado;
  return { animal, descartados: a.eventos.length - eventos.length + cortados + perdidos(a, animal, ['nombre', 'nac', 'finca', 'raza', 'categoria', 'notas']) };
}

export function cargar(): Db {
  const db: Db = { animales: {} };
  let crudo: string | null = null;
  try {
    crudo = localStorage.getItem(KEY);
    const datos = crudo ? JSON.parse(crudo) : null;
    if (crudo && (!datos || typeof datos.animales !== 'object')) throw new Error('sin animales');
    let malos = 0;
    for (const v of Object.values(datos?.animales ?? {})) { const l = limpiarAnimal(v); if (l) { db.animales[l.animal.arete] = l.animal; malos += l.descartados } else malos++ }
    if (malos) {
      // Primero el rescate; lo limpio se guarda solo si el rescate quedó, y así el aviso no se repite en cada apertura.
      try { localStorage.setItem(KEY + '.danado-' + Date.now(), crudo!); localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* sin espacio */ }
      alert(`Había ${malos === 1 ? '1 dato dañado o demasiado largo' : malos + ' datos dañados o demasiado largos'} y se quitó de la lista. Lo guardado antes quedó aparte: en “⚙️ Copia de seguridad” puede guardar los datos rescatados.`);
    }
  } catch {
    // Se guarda lo ilegible aparte antes de seguir: el próximo guardado no debe borrar lo único que había.
    try { if (crudo) localStorage.setItem(KEY + '.danado-' + Date.now(), crudo) } catch { /* sin espacio */ }
    alert('No se pudieron leer los datos guardados. Quedaron aparte: en “⚙️ Copia de seguridad” puede guardar los datos rescatados. Recupere su copia de seguridad.');
  }
  return db;
}
export function guardar(db: Db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); return true }
  catch { return false }
}
// Hato inventado para conocer la app. Solo vive en memoria (ver est.ejemplo).
export function datosDeEjemplo(desde = hoy()): Db {
  const d = (n: number) => sumarDias(desde, n);
  const ev = (id: string, tipo: TipoEvento, fecha: string, extra: Partial<Evento> = {}): Evento => ({ id: 'ej' + id + 'abcd', tipo, fecha, nota: '', ...extra });
  const vaca = (arete: string, nombre: string, finca: string, eventos: Evento[], extra: Partial<Animal> = {}): Animal =>
    ({ arete, nombre, tipo: 'leche', nac: '2020-03-10', finca, sexo: 'H', raza: 'Jersey', categoria: 'Vaca', notas: '', eventos, ...extra });
  const lista = [
    vaca('CR-001-4521', 'Pinta', 'La Esperanza', [ev('01', 'monta', d(-262)), ev('02', 'pesaje', d(-7), { am: 11.5, pm: 9 }), ev('03', 'pesaje', d(-1), { am: 12, pm: 9.5 })]),
    vaca('CR-001-4533', 'Canela', 'La Esperanza', [ev('04', 'parto', d(-120)), ev('05', 'pesaje', d(-7), { am: 14, pm: 11 }), ev('06', 'pesaje', d(-1), { am: 13.5, pm: 11 })]),
    vaca('CR-001-4547', 'Manchas', 'La Esperanza', [ev('07', 'monta', d(-30)), ev('08', 'celo', d(-9))]),
    vaca('CR-001-4560', '', 'La Esperanza', [ev('09', 'secado', d(-20))]),
    vaca('CR-002-1102', 'Negra', 'El Roble', [ev('10', 'monta', d(-100))], { tipo: 'carne', raza: 'Brahman' }),
    vaca('CR-002-1118', '', 'El Roble', [], { tipo: 'carne', raza: 'Brahman', sexo: 'M', categoria: 'Toro' }),
  ];
  return { animales: Object.fromEntries(lista.map(a => [a.arete, a])) };
}
// Lo que se apartó porque no se pudo leer o validar al cargar.
export const rescatados = () => { try { return Object.keys(localStorage).filter(k => k.startsWith(KEY + '.danado-')) } catch { return [] } };
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

// Gestación abierta: última monta/preñez sin parto, aborto ni celo posterior. Fecha base = la monta más reciente antes de esa preñez.
function baseAbierta(eventos: Evento[]) {
  let base: string | null = null;
  for (const e of eventos) {
    if (e.tipo === 'monta') base = e.fecha;
    else if (e.tipo === 'prenez' && !base) base = e.fecha;
    else if (e.tipo === 'parto' || e.tipo === 'aborto' || e.tipo === 'celo') base = null; // volver a celo anula la preñez
  }
  return base;
}
// Celo de una vaca que estaba preñada: es una repetición y anuló esa preñez.
export function esRepeticion(a: Animal, e: Evento) {
  const o = ordenados(a);
  return e.tipo === 'celo' && a.sexo !== 'M' && !!baseAbierta(o.slice(0, o.indexOf(e)));
}
export function prenezAbierta(a: Animal) {
  const base = a.sexo === 'M' ? null : baseAbierta(ordenados(a));
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
export const textoEvento = (e: Evento, a: Animal) => esRepeticion(a, e) ? 'Celo (repetición: se anuló la preñez)' : e.tipo === 'retiro' ? 'Salida: ' + e.motivo
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

// Campos de texto que pueden estar vacíos (tipo y sexo siempre tienen valor: no se sabe si se eligieron).
const LLENABLES = ['nombre', 'nac', 'finca', 'raza', 'categoria', 'notas'] as const;
// Fusiona sin borrar: animales nuevos se agregan, eventos se unen por id. Los datos locales del animal ganan.
// shortcut: un evento borrado reaparece si otro respaldo aún lo tiene; añadir "borrados" si estorba.
export function fusionar(dst: Db, src: unknown) {
  const s = src as Db;
  if (!s || typeof s !== 'object' || !s.animales || typeof s.animales !== 'object') throw new Error('no es un respaldo de ganado');
  const n = { animales: 0, eventos: 0, descartados: 0 };
  // Primero se revisa todo: si un animal está mal, no se importa nada (nunca una copia a medias).
  const limpios = Object.entries(s.animales).map(([k, v]) => {
    const l = limpiarAnimal(v);
    if (!l) throw new Error('animal mal formado: ' + String(k).slice(0, 40));
    n.descartados += l.descartados;
    return l.animal;
  });
  for (const a of limpios) {
    const loc = Object.hasOwn(dst.animales, a.arete) ? dst.animales[a.arete] : undefined;
    if (!loc) { dst.animales[a.arete] = a; n.animales++; n.eventos += a.eventos.length; continue }
    // Lo que aquí está vacío se completa con la copia (un nombre puesto en otro teléfono); lo ya escrito no se pisa.
    for (const k of LLENABLES) if (!loc[k] && a[k]) loc[k] = a[k];
    const ids = new Set(loc.eventos.map(x => x.id));
    let traslado = false;
    for (const ev of a.eventos) if (!ids.has(ev.id)) { loc.eventos.push(ev); n.eventos++; traslado ||= ev.tipo === 'traslado' }
    // Un traslado nuevo anotado en otro teléfono también cambia la finca aquí. Sin traslado nuevo, se respeta la finca de este teléfono.
    if (traslado) loc.finca = fincaPorTraslados(loc) ?? loc.finca;
  }
  return n;
}
