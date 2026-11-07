// Cada reporte es un objeto simple que se pinta igual en pantalla, en PDF (imprimir) y en imagen (para enviar por mensaje).
import { Animal, Db, EVENTOS, LECHE_POR_KG_CONCENTRADO, MOTIVOS, concentrado, cuantos, kilos, pesajeDe, totalPesaje, diasHasta, edad, fmt, hoy, nombreA, ordenados, porArete, textoEvento, prenezAbierta, retiro } from './datos';

export interface Seccion { titulo: string; nota: string; cols: string[]; filas: string[][] }
export interface Reporte { titulo: string; sub: string; secciones: Seccion[] }
export type TipoReporte = 'inventario' | 'partos' | 'salidas' | 'traslados' | 'pesajes' | 'ficha';

// En los reportes, como en el campo, basta con los últimos 4 dígitos del arete oficial; el nombre va en su propia columna.
// Si otro animal termina en los mismos 4 dígitos, se muestra completo para no confundirlos.
const areteCorto = (a: Animal, db: Db) => {
  const fin = a.arete.slice(-4), corto = /^\d{5,}$/.test(a.arete) && !Object.values(db.animales).some(o => o !== a && o.arete.endsWith(fin));
  return corto ? fin : a.arete.startsWith('PEND-') ? 'sin arete' : a.arete; // PEND-: arete provisional, todavía sin el oficial
};
const animal = (a: Animal, db: Db) => [areteCorto(a, db), a.nombre];
const activos = (db: Db) => Object.values(db.animales).filter(a => !retiro(a)).sort(porArete);
const contar = (lista: Animal[]) => {
  const c: Record<string, number> = {};
  for (const a of lista) if (a.categoria) c[a.categoria] = (c[a.categoria] || 0) + 1;
  return Object.entries(c).map(([k, n]) => `${n} ${k}`).join(' · ');
};

export function inventario(db: Db): Reporte {
  const porFinca: Record<string, Animal[]> = {};
  for (const a of activos(db)) (porFinca[a.finca || 'Sin finca'] ??= []).push(a);
  const total = Object.values(porFinca).flat().length;
  return {
    titulo: 'Animales por finca', sub: `${cuantos(total, 'animal activo', 'animales activos')} · ${fmt(hoy())}`,
    secciones: Object.keys(porFinca).sort().map(f => ({
      titulo: `${f} — ${cuantos(porFinca[f].length, 'animal', 'animales')}`, nota: contar(porFinca[f]),
      cols: ['Arete', 'Nombre', 'Categoría', 'Raza', 'Edad'], filas: porFinca[f].map(a => [...animal(a, db), a.categoria, a.raza, edad(a.nac)]),
    })),
  };
}

export function partos(db: Db): Reporte {
  const filas = activos(db).map(a => ({ a, p: prenezAbierta(a) })).filter(x => x.p).sort((x, y) => x.p!.parto.localeCompare(y.p!.parto))
    .map(({ a, p }) => {
      const d = diasHasta(p!.parto);
      return [...animal(a, db), a.finca, fmt(p!.parto), p!.secado ? fmt(p!.secado) : '—', d < 0 ? `Pasó hace ${-d} días` : `Faltan ${d} días`];
    });
  return {
    titulo: 'Próximos partos y secados', sub: `${cuantos(filas.length, 'vaca preñada', 'vacas preñadas')} · ${fmt(hoy())}`,
    secciones: [{
      titulo: '', nota: filas.length ? 'Parto = monta + 283 días. Secar 60 días antes (solo leche).' : 'No hay vacas preñadas anotadas.',
      cols: ['Arete', 'Nombre', 'Finca', 'Parto', 'Secar', 'Cuándo'], filas,
    }],
  };
}

const nombreDelMes = (mes: string) => new Date(mes + '-15T12:00:00Z').toLocaleDateString('es', { month: 'long', year: 'numeric', timeZone: 'UTC' });

// Fechas con pesaje, de la más nueva a la más vieja.
export const fechasDePesaje = (db: Db) => [...new Set(Object.values(db.animales).flatMap(a => a.eventos.filter(e => e.tipo === 'pesaje').map(e => e.fecha)))].sort().reverse();

// Pesaje de un día por finca: mañana, tarde, total y cambio contra el pesaje anterior de cada vaca.
export function pesajes(db: Db, fecha: string): Reporte {
  const filas = Object.values(db.animales).map(a => ({ a, p: pesajeDe(a, fecha) })).filter(x => x.p)
    .sort((x, y) => x.a.finca.localeCompare(y.a.finca) || totalPesaje(y.p!) - totalPesaje(x.p!));
  const porFinca: Record<string, typeof filas> = {};
  for (const x of filas) (porFinca[x.a.finca || 'Sin finca'] ??= []).push(x);
  const anterior = (a: Animal) => ordenados(a).filter(e => e.tipo === 'pesaje' && e.fecha < fecha).pop();
  return {
    titulo: 'Pesaje de leche del ' + fmt(fecha), sub: filas.length ? cuantos(filas.length, 'vaca pesada', 'vacas pesadas') : 'No hay pesaje en esta fecha.',
    secciones: Object.keys(porFinca).sort().map(f => {
      const xs = porFinca[f], suma = xs.reduce((n, x) => n + totalPesaje(x.p!), 0), conc = xs.reduce((n, x) => n + concentrado(totalPesaje(x.p!)), 0);
      return {
        titulo: `${f} — ${kilos(suma)}`,
        nota: `Promedio por vaca: ${kilos(suma / xs.length)} · Concentrado del día: ${kilos(conc)} (1 kg por cada ${LECHE_POR_KG_CONCENTRADO} kg de leche)` + (xs.some(x => x.p!.am === undefined || x.p!.pm === undefined) ? '. Donde se pesó un solo ordeño, el concentrado sale sobre ese ordeño.' : ''),
        cols: ['Arete', 'Nombre', 'Mañana', 'Tarde', 'Total', 'Concentrado', 'Cambio'],
        filas: xs.map(({ a, p }) => {
          const ant = anterior(a), dif = ant ? totalPesaje(p!) - totalPesaje(ant) : null;
          return [...animal(a, db), kilos(p!.am ?? 0), kilos(p!.pm ?? 0), kilos(totalPesaje(p!)), kilos(concentrado(totalPesaje(p!))), dif === null ? '—' : (dif > 0 ? '▲ ' : dif < 0 ? '▼ ' : '') + kilos(Math.abs(dif))];
        }),
      };
    }),
  };
}

export function traslados(db: Db, mes: string): Reporte {
  const movs = Object.values(db.animales).flatMap(a => a.eventos.filter(e => e.tipo === 'traslado' && e.fecha.startsWith(mes)).map(e => ({ a, e })))
    .sort((x, y) => x.e.fecha.localeCompare(y.e.fecha) || porArete(x.a, y.a));
  // Resumen por ruta: "12 de La Esperanza a El Roble".
  const rutas: Record<string, number> = {};
  for (const { e } of movs) { const r = `${e.desde || '—'} a ${e.hacia}`; rutas[r] = (rutas[r] || 0) + 1 }
  return {
    titulo: 'Traslados de ' + nombreDelMes(mes), sub: cuantos(movs.length, 'animal trasladado', 'animales trasladados'),
    secciones: [{
      titulo: '', nota: movs.length ? Object.entries(rutas).map(([r, n]) => `${n} de ${r}`).join(' · ') : 'No se trasladó ningún animal este mes.',
      cols: ['Fecha', 'Arete', 'Nombre', 'De', 'A', 'Nota'], filas: movs.map(({ a, e }) => [fmt(e.fecha), ...animal(a, db), e.desde || '—', e.hacia ?? '', e.nota]),
    }],
  };
}

export function salidas(db: Db, mes: string): Reporte {
  const sal = Object.values(db.animales).map(a => ({ a, r: retiro(a)! })).filter(x => x.r && x.r.fecha.startsWith(mes))
    .sort((x, y) => x.r.fecha.localeCompare(y.r.fecha));
  const nombreMes = nombreDelMes(mes);
  return {
    titulo: 'Salidas de ' + nombreMes, sub: `${sal.length === 1 ? '1 animal salió' : sal.length + ' animales salieron'}`,
    secciones: [{
      titulo: '', nota: sal.length ? MOTIVOS.map(m => `${sal.filter(x => x.r.motivo === m).length} ${m}`).join(' · ') : 'Ningún animal salió este mes.',
      cols: ['Fecha', 'Arete', 'Nombre', 'Finca', 'Motivo', 'Nota'], filas: sal.map(({ a, r }) => [fmt(r.fecha), ...animal(a, db), a.finca, r.motivo ?? '', r.nota]),
    }],
  };
}

export function ficha(a: Animal): Reporte {
  const p = prenezAbierta(a), r = retiro(a);
  const estado = r ? `Retirado: ${r.motivo} el ${fmt(r.fecha)}` : p ? `Preñada · parto ${fmt(p.parto)}` + (p.secado ? ` · secar ${fmt(p.secado)}` : '') : 'Activo';
  const datos = [['Arete', a.arete], ['Nombre', a.nombre], ['Finca', a.finca], ['Tipo', a.tipo === 'leche' ? 'Leche' : 'Carne'],
    ['Sexo', a.sexo === 'M' ? 'Macho' : 'Hembra'], ['Raza', a.raza], ['Categoría', a.categoria],
    ['Nacimiento', a.nac ? `${fmt(a.nac)} (${edad(a.nac)})` : ''], ['Estado', estado], ['Notas', a.notas]].filter(x => x[1]);
  return {
    titulo: 'Ficha del animal ' + nombreA(a), sub: fmt(hoy()),
    secciones: [
      { titulo: 'Datos', nota: '', cols: [], filas: datos },
      { titulo: 'Historial', nota: a.eventos.length ? '' : 'Sin eventos.', cols: ['Fecha', 'Evento', 'Nota'],
        filas: ordenados(a).reverse().map(e => [fmt(e.fecha), textoEvento(e, a), e.nota]) },
    ],
  };
}

// Dibuja el reporte como imagen. Columnas con ancho según su texto; las de la derecha se recortan con "…" si no caben.
export function reporteAImagen(r: Reporte): HTMLCanvasElement {
  const W = 1080, P = 48, LH = 46, RENGLON = 38, c = document.createElement('canvas'), x = c.getContext('2d')!;
  const F = (peso: number, tam: number) => `${peso} ${tam}px system-ui, sans-serif`;
  const corta = (t: string, max: number) => {
    if (x.measureText(t).width <= max) return t;
    while (t && x.measureText(t + '…').width > max) t = t.slice(0, -1);
    return t + '…';
  };
  // Parte el texto en renglones que quepan en "max", sin cortar datos: una palabra muy larga (un arete) se parte por letras.
  const partir = (t: string, max: number) => {
    const renglones: string[] = [];
    let r = '';
    for (const palabra of t.split(' ')) {
      const prueba = r ? r + ' ' + palabra : palabra;
      if (x.measureText(prueba).width <= max) { r = prueba; continue }
      if (r) renglones.push(r);
      r = '';
      for (const letra of palabra) {
        if (r && x.measureText(r + letra).width > max) { renglones.push(r); r = '' }
        r += letra;
      }
    }
    return [...renglones, r];
  };
  const pasos: (() => void)[] = []; // primero se mide la altura total, luego se dibuja
  pasos.push(() => {
    x.fillStyle = '#2f6f3e'; x.fillRect(0, 0, W, 150);
    x.fillStyle = '#fff'; x.font = F(700, 50); x.fillText(corta('🐄 ' + r.titulo, W - 2 * P), P, 80);
    x.font = F(400, 30); x.fillText(r.sub, P, 125);
  });
  // Los teléfonos no dibujan imágenes gigantes (iPhone: ~16 millones de puntos). Si no cabe, se corta con una nota.
  const MAX_ALTO = 12000;
  let y = 200, faltan = 0;
  secciones: for (const [si, s] of r.secciones.entries()) {
    if (y > MAX_ALTO - 300) { faltan += r.secciones.slice(si).reduce((n, x) => n + x.filas.length, 0); break }
    if (s.titulo) { const yy = y; pasos.push(() => { x.fillStyle = '#2f6f3e'; x.font = F(700, 38); x.fillText(corta(s.titulo, W - 2 * P), P, yy) }); y += 56 }
    if (s.nota) {
      x.font = F(400, 30);
      const renglones = partir(s.nota, W - 2 * P), yy = y;
      pasos.push(() => { x.fillStyle = '#333'; x.font = F(400, 30); renglones.forEach((t, j) => x.fillText(t, P, yy + j * RENGLON)) });
      y += renglones.length * RENGLON + 12;
    }
    if (!s.filas.length) continue;
    x.font = F(400, 30);
    const filas = s.cols.length ? [s.cols, ...s.filas] : s.filas;
    const n = filas[0].length, anchos = Array.from({ length: n }, (_, i) => Math.max(...filas.map(f => x.measureText(f[i] ?? '').width)) + 28);
    // Si no caben: cada columna tiene al menos el ancho de su palabra más larga (un arete no se parte),
    // y lo que sobra se reparte según cuánto le falta a cada una para verse en un solo renglón.
    const total = anchos.reduce((a, b) => a + b, 0);
    if (total > W - 2 * P) {
      const minimos = anchos.map((_, i) => Math.max(...filas.flatMap(f => (f[i] ?? '').split(' ').map(p => x.measureText(p).width))) + 28);
      const sumaMin = minimos.reduce((a, b) => a + b, 0), extra = Math.max(0, W - 2 * P - sumaMin), pide = total - sumaMin;
      anchos.forEach((w, i) => { anchos[i] = sumaMin > W - 2 * P ? (W - 2 * P) / n : minimos[i] + extra * (w - minimos[i]) / pide });
    }
    for (const [k, f] of filas.entries()) {
      if (y > MAX_ALTO - 150) {
        faltan += filas.length - k + r.secciones.slice(si + 1).reduce((n, x) => n + x.filas.length, 0);
        break secciones;
      }
      const yy = y, cab = s.cols.length > 0 && k === 0, negrita = (i: number) => cab || (!s.cols.length && i === 0);
      const celdas = f.map((t, i) => { x.font = F(negrita(i) ? 700 : 400, 30); return partir(t ?? '', anchos[i] - 20) });
      const alto = LH + (Math.max(...celdas.map(c => c.length)) - 1) * RENGLON;
      pasos.push(() => {
        if (k % 2 === (s.cols.length ? 1 : 0)) { x.fillStyle = '#eef6ef'; x.fillRect(P - 10, yy - 34, W - 2 * P + 20, alto) }
        let xx = P;
        celdas.forEach((renglones, i) => {
          x.fillStyle = '#111'; x.font = F(negrita(i) ? 700 : 400, 30);
          renglones.forEach((t, j) => x.fillText(t, xx, yy + j * RENGLON));
          xx += anchos[i];
        });
      });
      y += alto;
    }
    y += 30;
  }
  if (faltan) {
    const yy = y + 10;
    pasos.push(() => { x.fillStyle = '#a32020'; x.font = F(700, 32); x.fillText(corta(`… y ${faltan} filas más: use “Guardar PDF” para verlo completo.`, W - 2 * P), P, yy) });
    y += 70;
  }
  c.width = W; c.height = y + 20;
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, c.height);
  pasos.forEach(p => p());
  return c;
}
