// Excel de SENASA (.xlsx) con los rangos de aretes que asignó a cada finca. Se lee en el teléfono, sin librerías:
// un .xlsx es un .zip con hojas XML, y el navegador ya sabe descomprimirlo (DecompressionStream).
import { Animal, Db, fincas } from './datos';
import { SinSoporte, descomprimir as descomprimirHasta } from './comprimir';

export interface Rango { finca: string; inicio: string; fin: string; total: number; fecha: string }
// Lo que la persona elige por cada finca del Excel antes de agregar.
export interface Destino { nombre: string; tipo: Animal['tipo'] }

// ---------- Lectura del .xlsx ----------
// Límites: el Excel de SENASA pesa unos KB. Un archivo dañado o hecho a propósito no debe colgar ni llenar el teléfono.
export const MAX_ENTREGAS = 1000, MAX_ARCHIVO = 5 * 2 ** 20, MAX_DESCOMPRIMIDO = 20 * 2 ** 20, MAX_COLUMNAS = 16384, MAX_FILAS = 50000;
const muyGrande = () => new Error('el Excel es demasiado grande para ser el de aretes de SENASA');

const descomprimir = (datos: Uint8Array) => descomprimirHasta(datos, MAX_DESCOMPRIMIDO, 'deflate-raw') // un .zip usa deflate sin cabecera
  .catch(e => { throw e instanceof RangeError ? muyGrande() : e instanceof SinSoporte ? e : new Error('el archivo de Excel está dañado') });

// Archivos del .zip por nombre: primero se miran los nombres, y solo se descomprimen los que se eligen.
async function abrirZip(buf: ArrayBuffer, elegir: (nombres: string[]) => string[]) {
  if (buf.byteLength > MAX_ARCHIVO) throw muyGrande();
  const v = new DataView(buf), b = new Uint8Array(buf), texto = new TextDecoder();
  let fin = b.length - 22;
  while (fin >= 0 && v.getUint32(fin, true) !== 0x06054b50) fin--;
  if (fin < 0) throw new Error(b[0] === 0x50 && b[1] === 0x4b ? 'el archivo de Excel está dañado o incompleto' : 'no es un archivo de Excel (.xlsx)');
  const entradas = new Map<string, { metodo: number; tam: number; local: number }>();
  for (let n = v.getUint16(fin + 10, true), p = v.getUint32(fin + 16, true); n > 0; n--) {
    if (p + 46 > b.length || v.getUint32(p, true) !== 0x02014b50) throw new Error('el archivo de Excel está dañado');
    const largo = v.getUint16(p + 28, true);
    entradas.set(texto.decode(b.subarray(p + 46, p + 46 + largo)), { metodo: v.getUint16(p + 10, true), tam: v.getUint32(p + 20, true), local: v.getUint32(p + 42, true) });
    p += 46 + largo + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  const archivos = new Map<string, string>();
  for (const nombre of elegir([...entradas.keys()])) {
    const e = entradas.get(nombre)!, ini = e.local + 30 + v.getUint16(e.local + 26, true) + v.getUint16(e.local + 28, true);
    archivos.set(nombre, texto.decode(e.metodo === 8 ? await descomprimir(b.subarray(ini, ini + e.tam)) : b.subarray(ini, ini + e.tam)));
  }
  return archivos;
}

const NOMBRADAS: Record<string, string> = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' };
const entidades = (t: string) => t.replace(/&(#x[\da-f]+|#\d+|lt|gt|quot|apos|amp);/gi, (_, e: string) =>
  e[0] !== '#' ? NOMBRADAS[e.toLowerCase()] : String.fromCodePoint(Math.min(parseInt(e[1] === 'x' || e[1] === 'X' ? e.slice(2) : e.slice(1), e[1] === 'x' || e[1] === 'X' ? 16 : 10), 0x10ffff)));
const textos = (xml: string) => [...xml.matchAll(/<t(?:\s[^<>]*)?>([^<]*)<\/t>/g)].map(m => entidades(m[1])).join('');
const columna = (ref: string) => [...ref.replace(/\d+/g, '')].reduce((n, l) => Math.min(n * 26 + l.charCodeAt(0) - 64, MAX_COLUMNAS + 1), 0) - 1;
// Trozos entre "<etiqueta" y su cierre, recorriendo el texto una sola vez (sin expresiones que se vuelvan lentas si falta un cierre).
function trozos(xml: string, etiqueta: string) {
  const out: string[] = [], abre = '<' + etiqueta, cierra = '</' + etiqueta + '>';
  for (let i = xml.indexOf(abre); i >= 0; i = xml.indexOf(abre, i + 1)) {
    const sig = xml[i + abre.length];
    if (sig !== '>' && sig !== ' ' && sig !== '/') continue; // "<c" no es "<cols"
    const finEtiqueta = xml.indexOf('>', i);
    if (finEtiqueta < 0) break;
    if (xml[finEtiqueta - 1] === '/') { out.push(xml.slice(i, finEtiqueta + 1)); i = finEtiqueta; continue } // <si/>: vacío, pero cuenta
    const fin = xml.indexOf(cierra, finEtiqueta);
    if (fin < 0) break;
    out.push(xml.slice(i, fin)); i = fin;
    if (out.length > MAX_FILAS * 20) throw muyGrande();
  }
  return out;
}

// Filas de la primera hoja, como texto.
export async function leerXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const hojaDe = (nombres: string[]) => nombres.filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.slice(19)) - parseInt(b.slice(19)))[0];
  let hoja = '';
  const z = await abrirZip(buf, nombres => { hoja = hojaDe(nombres) ?? ''; return [hoja, 'xl/sharedStrings.xml'].filter(n => n && nombres.includes(n)) });
  if (!hoja) throw new Error('el Excel no tiene hojas');
  const comunes = trozos(z.get('xl/sharedStrings.xml') ?? '', 'si').map(textos);
  const filas = trozos(z.get(hoja)!, 'row');
  if (filas.length > MAX_FILAS) throw muyGrande();
  return filas.map(fila => {
    const celdas: string[] = [];
    for (const c of trozos(fila, 'c')) {
      const cab = c.slice(0, c.indexOf('>') + 1), cuerpo = c.slice(cab.length);
      const ref = /\br="([A-Z]{1,3}\d+)"/.exec(cab)?.[1], tipo = /\bt="(\w+)"/.exec(cab)?.[1], v = /<v>([^<]*)<\/v>/.exec(cuerpo)?.[1];
      if (!ref || columna(ref) >= MAX_COLUMNAS) continue;
      celdas[columna(ref)] = tipo === 's' ? comunes[Number(v)] ?? '' : tipo === 'inlineStr' ? textos(cuerpo) : entidades(v ?? '');
    }
    return celdas; // sin rellenar los huecos: una celda en la columna 16384 no crea 16384 textos
  });
}

// ---------- Del Excel a rangos de aretes ----------
// Un número guardado como número puede venir en notación científica ("1.88002916945E11"): se pasa a dígitos si es entero exacto.
const digitos = (t: string) => {
  t = (t ?? '').trim();
  if (/^\d{1,20}$/.test(t)) return t;
  const n = Number(t);
  return /^\d(\.\d+)?e\+?\d+$/i.test(t) && Number.isSafeInteger(n) ? String(n) : '';
};
// Un "Total" que no es un entero (2.5, 1e999) vale 0: así la entrega queda "sin lista" en vez de romper la pantalla.
const entero = (t: string) => { const n = Number(t); return Number.isSafeInteger(n) && n >= 0 ? n : 0 };
// La fecha puede venir como texto "21/10/2026" o como número de día de Excel (días desde el 30/12/1899).
const fechaDe = (t: string) => {
  t = (t ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(t)) return t;
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(t)) * 864e5);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
};
// Busca las columnas por su encabezado (no por posición): así sirve aunque SENASA agregue o mueva columnas.
export function rangosDeSenasa(filas: string[][]): Rango[] {
  const i = filas.findIndex(f => f.includes('Rango Inicial') && f.includes('Rango Final'));
  if (i < 0) throw new Error('no parece el Excel de aretes de SENASA (falta «Rango Inicial»)');
  const col = (nombre: string) => filas[i].indexOf(nombre);
  const [cf, ci, cn, ct, cd] = ['NombreEstablecimiento', 'Rango Inicial', 'Rango Final', 'Total', 'Fecha'].map(col);
  return filas.slice(i + 1).map(f => ({ f, inicio: digitos(f[ci]), fin: digitos(f[cn]) })).filter(x => x.inicio.length >= 5 && x.fin.length >= 5)
    .map(({ f, inicio, fin }) => ({ finca: (f[cf] ?? '').trim().slice(0, 80), inicio, fin, total: entero(f[ct]), fecha: fechaDe(f[cd]) }))
    .slice(0, MAX_ENTREGAS + 1).map((r, k) => { if (k >= MAX_ENTREGAS) throw muyGrande(); return r });
}
// Un rango es "seguido" si del primero al último hay justo "total" aretes: entonces se conocen todos.
export const seguido = (r: Rango) => r.inicio.length === r.fin.length && BigInt(r.fin) - BigInt(r.inicio) + 1n === BigInt(r.total);
const aretesDe = (r: Rango) => Array.from({ length: r.total }, (_, k) => (BigInt(r.inicio) + BigInt(k)).toString().padStart(r.inicio.length, '0'));

// ---------- Propuesta por finca ----------
// Sin "FINCA", "PARCELA 14-" ni espacios de más: lo que de verdad nombra a la finca.
const limpio = (t: string) => t.replace(/\b(finca|parcela|hacienda)\b[\s\d-]*/gi, '').replace(/\s+/g, ' ').trim();
const normal = (t: string) => limpio(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const titulo = (t: string) => t.toLowerCase().replace(/(^|\s)\p{L}/gu, l => l.toUpperCase());
// La finca de la app que más se parece al nombre del Excel ("PARCELA 14-LA PONDEROSA" → "La Ponderosa"), o el nombre limpio.
export function propuestaDeFinca(db: Db, enExcel: string): Destino {
  const n = normal(enExcel), suyas = fincas(db);
  const nombre = suyas.find(f => normal(f) === n) ?? suyas.find(f => n.includes(normal(f)) || normal(f).includes(n)) ?? titulo(limpio(enExcel) || enExcel).slice(0, 80);
  const tipos = Object.values(db.animales).filter(a => a.finca === nombre).map(a => a.tipo);
  return { nombre, tipo: tipos.filter(t => t === 'carne').length > tipos.length / 2 ? 'carne' : 'leche' };
}

// ---------- Agregar ----------
// Más que esto en una entrega, o en todo el Excel, casi seguro es un Excel mal leído: no se crean miles de animales de golpe.
export const MAX_POR_ENTREGA = 2000, MAX_NUEVOS = 5000;
// Por qué una entrega no se agrega: sin lista (solo primero y último), demasiados aretes, o con menos dígitos de lo normal.
export type Motivo = 'sin-lista' | 'demasiados' | 'sin-cero' | 'largo-raro';
// digitos: cuántos números tiene el arete de esa entrega; normal: cuántos tienen los suyos (para explicar sin-cero y largo-raro).
export interface Omitida { finca: string; total: number; yaEstan: number; motivo: Motivo; digitos: number; normal: number }

// Largo normal de un arete: el más común entre los que ya hay en la app, o si no el más común del Excel.
// Un arete más corto perdió un 0 inicial (Excel lo guardó como número): no se adivina, se avisa. Así no se crean animales gemelos.
// El largo que más se repite: el de la app si ya tiene aretes numéricos; si está vacía, el del Excel.
const masComun = (largos: number[]) => {
  const cuenta = new Map<number, number>();
  for (const l of largos) cuenta.set(l, (cuenta.get(l) ?? 0) + 1);
  return [...cuenta].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 0;
};
function largoNormal(db: Db, rangos: Rango[]) {
  // Solo cuentan los aretes de 10 dígitos o más: los números propios cortos (de la finca) no son aretes oficiales.
  return masComun(Object.keys(db.animales).filter(k => /^\d{10,}$/.test(k)).map(k => k.length)) || masComun(rangos.map(r => r.inicio.length));
}
export function motivo(r: Rango, largo: number): Motivo | null {
  if (r.inicio.length < largo) return 'sin-cero';
  if (r.inicio.length > largo) return 'largo-raro';
  if (!seguido(r)) return 'sin-lista';
  return r.total > MAX_POR_ENTREGA ? 'demasiados' : null;
}
// Los aretes numéricos de la app, pasados a número una sola vez (el plan se calcula en cada repintado).
const numericos = (db: Db) => Object.keys(db.animales).filter(k => /^\d{1,20}$/.test(k)).map(k => ({ largo: k.length, n: BigInt(k) }));
const enRango = (aretes: { largo: number; n: bigint }[], r: Rango) => {
  const ini = BigInt(r.inicio), fin = BigInt(r.fin);
  return aretes.filter(a => a.largo === r.inicio.length && a.n >= ini && a.n <= fin).length;
};

// Lo que pasaría al agregar, sin tocar nada: cuántos aretes nuevos, a cuántos se les llena la finca y qué entregas no se agregan.
// Deja de contar en cuanto pasa de MAX_NUEVOS (no recorre millones de aretes de un Excel malicioso).
export function planSenasa(db: Db, rangos: Rango[]) {
  const largo = largoNormal(db, rangos), omitidas: (Omitida & { rango: Rango })[] = [];
  let aretes: ReturnType<typeof numericos> | undefined;
  let nuevos = 0, sinFinca = 0;
  const porFinca: Record<string, number> = {}; // por finca del Excel: cuántos aretes nuevos o sin finca hay que tocar
  for (const r of rangos) {
    const m = motivo(r, largo);
    if (m) { omitidas.push({ rango: r, finca: r.finca, total: r.total, yaEstan: enRango(aretes ??= numericos(db), r), motivo: m, digitos: r.inicio.length, normal: largo }); continue }
    for (const arete of aretesDe(r)) {
      const a = Object.hasOwn(db.animales, arete) ? db.animales[arete] : undefined;
      if (!a) nuevos++; else if (!a.finca) sinFinca++; else continue;
      porFinca[r.finca] = (porFinca[r.finca] ?? 0) + 1;
    }
    if (nuevos > MAX_NUEVOS) break;
  }
  return { nuevos, sinFinca, omitidas, largo, porFinca };
}

export interface Resultado { nuevos: number; fincasLlenadas: number; omitidas: Omitida[] }
// Crea los aretes que faltan de las entregas que se pueden agregar; de los que ya existen solo llena la finca si está vacía. Nunca borra.
export function agregarSenasa(db: Db, rangos: Rango[], destinos: Record<string, Destino>): Resultado {
  const plan = planSenasa(db, rangos);
  if (plan.nuevos > MAX_NUEVOS) throw new Error(`el Excel crearía más de ${MAX_NUEVOS} animales de una vez`);
  const res: Resultado = { nuevos: 0, fincasLlenadas: 0, omitidas: plan.omitidas.map(({ rango: _, ...o }) => ({ ...o, finca: destinos[o.finca]?.nombre ?? o.finca })) };
  const omitidas = new Set(plan.omitidas.map(o => o.rango));
  for (const r of rangos) {
    if (omitidas.has(r)) continue;
    const d = destinos[r.finca] ?? { nombre: r.finca, tipo: 'leche' as const };
    for (const arete of aretesDe(r)) {
      const a = Object.hasOwn(db.animales, arete) ? db.animales[arete] : undefined;
      if (a) { if (!a.finca && d.nombre) { a.finca = d.nombre; res.fincasLlenadas++ } continue }
      db.animales[arete] = { arete, nombre: '', tipo: d.tipo, nac: '', finca: d.nombre, sexo: 'H', raza: '', categoria: '', eventos: [],
        notas: `Arete asignado por SENASA${r.fecha ? ' el ' + r.fecha : ''}. Falta completar sexo, raza y nacimiento.` };
      res.nuevos++;
    }
  }
  return res;
}
