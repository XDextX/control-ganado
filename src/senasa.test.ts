import { describe, expect, it } from 'vitest';
import { Db } from './datos';
import { MAX_NUEVOS, agregarSenasa, leerXlsx, planSenasa, propuestaDeFinca, rangosDeSenasa, seguido } from './senasa';

// Un .xlsx mínimo hecho aquí mismo (datos inventados): un .zip con la hoja y los textos comunes, comprimidos como lo hace Excel.
async function comprimir(t: string) {
  const s = new Blob([new TextEncoder().encode(t)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function xlsx(archivos: Record<string, string>) {
  const partes: Uint8Array[] = [], central: Uint8Array[] = [];
  let pos = 0;
  for (const [nombre, contenido] of Object.entries(archivos)) {
    const n = new TextEncoder().encode(nombre), datos = await comprimir(contenido), crudo = new TextEncoder().encode(contenido);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(8, 8, true); local.setUint32(18, datos.length, true); local.setUint32(22, crudo.length, true); local.setUint16(26, n.length, true);
    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true); dir.setUint16(10, 8, true); dir.setUint32(20, datos.length, true); dir.setUint32(24, crudo.length, true); dir.setUint16(28, n.length, true); dir.setUint32(42, pos, true);
    partes.push(new Uint8Array(local.buffer), n, datos); central.push(new Uint8Array(dir.buffer), n);
    pos += 30 + n.length + datos.length;
  }
  const tamDir = central.reduce((s, x) => s + x.length, 0), fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(10, Object.keys(archivos).length, true); fin.setUint32(12, tamDir, true); fin.setUint32(16, pos, true);
  return await new Blob([...partes, ...central, new Uint8Array(fin.buffer)]).arrayBuffer();
}
const fila = (n: number, celdas: [string, string][]) =>
  `<row r="${n}">${celdas.map(([ref, v]) => /^\d+$/.test(v) ? `<c r="${ref}${n}"><v>${v}</v></c>` : `<c r="${ref}${n}" t="inlineStr"><is><t>${v}</t></is></c>`).join('')}</row>`;

describe('Excel de SENASA', () => {
  it('lee la hoja (textos comunes, números y textos en la celda) y saca los rangos', async () => {
    const hoja = `<worksheet><sheetData>${[
      `<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c><c r="E1" t="s"><v>4</v></c></row>`,
      fila(2, [['A', 'FINCA EL ROBLE'], ['B', '999000000001'], ['C', '999000000003'], ['D', '3'], ['E', '21/10/2026']]),
      fila(3, [['A', 'Parcela 2-La Esperanza &amp; Cia'], ['B', '999000000010'], ['C', '999000500000'], ['D', '2'], ['E', '01/08/2026']]),
      fila(4, [['A', ''], ['B', 'TOTAL'], ['D', '5']]),
    ].join('')}</sheetData></worksheet>`;
    const comunes = `<sst>${['NombreEstablecimiento', 'Rango Inicial', 'Rango Final', 'Total', 'Fecha'].map(t => `<si><t>${t}</t></si>`).join('')}</sst>`;
    const filas = await leerXlsx(await xlsx({ 'xl/sharedStrings.xml': comunes, 'xl/worksheets/sheet1.xml': hoja }));
    const r = rangosDeSenasa(filas);
    expect(r).toEqual([
      { finca: 'FINCA EL ROBLE', inicio: '999000000001', fin: '999000000003', total: 3, fecha: '21/10/2026' },
      { finca: 'Parcela 2-La Esperanza & Cia', inicio: '999000000010', fin: '999000500000', total: 2, fecha: '01/08/2026' },
    ]);
    expect(r.map(seguido)).toEqual([true, false]);
  });

  it('rechaza un archivo que no es el Excel de aretes', async () => {
    await expect(leerXlsx(new TextEncoder().encode('hola').buffer as ArrayBuffer)).rejects.toThrow('no es un archivo de Excel');
    expect(() => rangosDeSenasa([['otra', 'cosa']])).toThrow('Rango Inicial');
  });

  it('propone la finca que ya existe y su tipo', () => {
    const db: Db = { animales: { X: { arete: 'X', nombre: '', tipo: 'carne', nac: '', finca: 'El Roble', sexo: 'H', raza: '', categoria: '', notas: '', eventos: [] } } };
    expect(propuestaDeFinca(db, 'FINCA EL ROBLE')).toEqual({ nombre: 'El Roble', tipo: 'carne' });
    expect(propuestaDeFinca(db, 'PARCELA 14-LOS ÁLAMOS')).toEqual({ nombre: 'Los Álamos', tipo: 'leche' });
  });

  it('agrega solo lo que falta, llena la finca vacía y avisa los rangos con huecos', () => {
    const db: Db = { animales: {
      '999000000001': { arete: '999000000001', nombre: 'Mora', tipo: 'leche', nac: '', finca: '', sexo: 'H', raza: 'Jersey', categoria: '', notas: '', eventos: [] },
      '999000000020': { arete: '999000000020', nombre: '', tipo: 'carne', nac: '', finca: 'Norte', sexo: 'H', raza: '', categoria: '', notas: '', eventos: [] },
    } };
    const res = agregarSenasa(db, [
      { finca: 'FINCA EL ROBLE', inicio: '999000000001', fin: '999000000003', total: 3, fecha: '21/10/2026' },
      { finca: 'OTRA', inicio: '999000000010', fin: '999000500000', total: 2, fecha: '' },
    ], { 'FINCA EL ROBLE': { nombre: 'El Roble', tipo: 'carne' }, OTRA: { nombre: 'Norte', tipo: 'carne' } });
    expect(res).toEqual({ nuevos: 2, fincasLlenadas: 1, omitidas: [{ finca: 'Norte', total: 2, yaEstan: 1, motivo: 'sin-lista', digitos: 12, normal: 12 }] });
    expect(db.animales['999000000001']).toMatchObject({ nombre: 'Mora', tipo: 'leche', finca: 'El Roble', raza: 'Jersey' });
    expect(db.animales['999000000003']).toMatchObject({ tipo: 'carne', finca: 'El Roble', notas: expect.stringContaining('21/10/2026') });
  });
});

describe('Excel de SENASA: límites y formatos raros', () => {
  const hojaCon = (filas: string) => `<worksheet><sheetData>${fila(1, [['A', 'NombreEstablecimiento'], ['B', 'Rango Inicial'], ['C', 'Rango Final'], ['D', 'Total'], ['E', 'Fecha']])}${filas}</sheetData></worksheet>`;

  it('no pisa la finca de un animal que ya la tiene', () => {
    const db: Db = { animales: { '999000000001': { arete: '999000000001', nombre: '', tipo: 'leche', nac: '', finca: 'Sur', sexo: 'H', raza: '', categoria: '', notas: '', eventos: [] } } };
    const r = agregarSenasa(db, [{ finca: 'X', inicio: '999000000001', fin: '999000000001', total: 1, fecha: '' }], { X: { nombre: 'Norte', tipo: 'carne' } });
    expect(r.fincasLlenadas).toBe(0);
    expect(db.animales['999000000001']).toMatchObject({ finca: 'Sur', tipo: 'leche' });
  });

  it('lee notación científica, fecha como número de Excel, <si/> vacío y entidades numéricas', async () => {
    const comunes = `<sst><si/><si><t>Agr&#237;cola &#x00D3;</t></si></sst>`;
    const hoja = hojaCon(`<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>1.88002916945E11</v></c><c r="C2"><v>188002916945</v></c><c r="D2"><v>1</v></c><c r="E2"><v>46316</v></c></row>`);
    const r = rangosDeSenasa(await leerXlsx(await xlsx({ 'xl/sharedStrings.xml': comunes, 'xl/worksheets/sheet1.xml': hoja })));
    expect(r).toEqual([{ finca: 'Agrícola Ó', inicio: '188002916945', fin: '188002916945', total: 1, fecha: '21/10/2026' }]);
  });

  it('un arete que perdió el 0 inicial no se agrega: se avisa', () => {
    const db: Db = { animales: {} };
    const r = agregarSenasa(db, [
      { finca: 'X', inicio: '099000000001', fin: '099000000002', total: 2, fecha: '' },
      { finca: 'X', inicio: '99000000005', fin: '99000000005', total: 1, fecha: '' },
    ], { X: { nombre: 'Norte', tipo: 'carne' } });
    expect(r.nuevos).toBe(2);
    expect(r.omitidas).toEqual([{ finca: 'Norte', total: 1, yaEstan: 0, motivo: 'sin-cero', digitos: 11, normal: 12 }]);
    expect(Object.keys(db.animales)).toEqual(['099000000001', '099000000002']);
  });

  it('rechaza un archivo que se infla demasiado al descomprimir', async () => {
    const enorme = 'x'.repeat(21 * 2 ** 20);
    await expect(leerXlsx(await xlsx({ 'xl/worksheets/sheet1.xml': enorme }))).rejects.toThrow('demasiado grande');
  });

  it('solo descomprime la primera hoja e ignora columnas imposibles y filas sin cerrar', async () => {
    const t0 = Date.now();
    const hoja = hojaCon(fila(2, [['A', 'FINCA X'], ['B', '999000000001'], ['C', '999000000001'], ['D', '1'], ['E', '01/08/2026']]).replace('</row>', '<c r="ZZZ2"><v>1</v></c></row>') + '<row r="3">'.repeat(20000));
    const filas = await leerXlsx(await xlsx({ 'xl/worksheets/sheet1.xml': hoja, 'xl/worksheets/sheet2.xml': 'x'.repeat(21 * 2 ** 20) }));
    expect(rangosDeSenasa(filas)).toHaveLength(1);
    expect(Math.max(...filas.map(f => f.length))).toBeLessThanOrEqual(16384);
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  it('una entrega seguida de más de 2000 aretes no se agrega: se avisa', () => {
    const db: Db = { animales: {} };
    const r = agregarSenasa(db, [{ finca: 'X', inicio: '999000000001', fin: '999000002001', total: 2001, fecha: '' }], { X: { nombre: 'Norte', tipo: 'carne' } });
    expect(r).toEqual({ nuevos: 0, fincasLlenadas: 0, omitidas: [{ finca: 'Norte', total: 2001, yaEstan: 0, motivo: 'demasiados', digitos: 12, normal: 12 }] });
  });

  it('rechaza un archivo de más de 5 MB, uno con demasiadas filas y uno dañado', async () => {
    await expect(leerXlsx(new ArrayBuffer(6 * 2 ** 20))).rejects.toThrow('demasiado grande');
    const filas = '<row r="1"></row>'.repeat(50001);
    await expect(leerXlsx(await xlsx({ 'xl/worksheets/sheet1.xml': `<worksheet><sheetData>${filas}</sheetData></worksheet>` }))).rejects.toThrow('demasiado grande');
    const roto = new Uint8Array(await xlsx({ 'xl/worksheets/sheet1.xml': '<worksheet>' + 'a'.repeat(5000) + '</worksheet>' }));
    roto.fill(0xff, 40, 60); // datos comprimidos estropeados
    await expect(leerXlsx(roto.buffer)).rejects.toThrow('dañado');
  });

  it('blindado: si todo el Excel perdió el 0 inicial, compara con los aretes que ya hay en la app y no crea gemelos', () => {
    const db: Db = { animales: { '058412300001': { arete: '058412300001', nombre: '', tipo: 'carne', nac: '', finca: 'Norte', sexo: 'H', raza: '', categoria: '', notas: '', eventos: [] } } };
    const r = agregarSenasa(db, [{ finca: 'X', inicio: '58412300001', fin: '58412300003', total: 3, fecha: '' }], { X: { nombre: 'Norte', tipo: 'carne' } });
    expect(r).toEqual({ nuevos: 0, fincasLlenadas: 0, omitidas: [{ finca: 'Norte', total: 3, yaEstan: 0, motivo: 'sin-cero', digitos: 11, normal: 12 }] });
    expect(Object.keys(db.animales)).toEqual(['058412300001']);
  });

  it('el tope total se revisa antes de crear nada y sin recorrer millones de aretes', () => {
    const rangos = Array.from({ length: 1000 }, (_, k) => ({ finca: 'X', inicio: String(999000000000 + k * 2000), fin: String(999000000000 + k * 2000 + 1999), total: 2000, fecha: '' }));
    const t0 = Date.now();
    expect(planSenasa({ animales: {} }, rangos).nuevos).toBeGreaterThan(MAX_NUEVOS);
    expect(Date.now() - t0).toBeLessThan(1000);
    const db: Db = { animales: {} };
    expect(() => agregarSenasa(db, rangos, { X: { nombre: 'Norte', tipo: 'carne' } })).toThrow(`más de ${MAX_NUEVOS}`);
    expect(Object.keys(db.animales)).toHaveLength(0);
  });

  it('no rellena filas con columnas lejanas, no acepta aretes de más de 20 dígitos y corta el nombre de finca', async () => {
    const t0 = Date.now();
    const hoja = `<worksheet><sheetData>${'<row r="1"><c r="XFD1"><v>1</v></c></row>'.repeat(20000)}</sheetData></worksheet>`;
    const filas = await leerXlsx(await xlsx({ 'xl/worksheets/sheet1.xml': hoja }));
    expect(filas[0].filter(() => true)).toHaveLength(1); // una sola celda guardada, no 16384
    expect(Date.now() - t0).toBeLessThan(3000);
    const cabecera = ['NombreEstablecimiento', 'Rango Inicial', 'Rango Final', 'Total', 'Fecha'];
    expect(rangosDeSenasa([cabecera, ['X', '1'.repeat(21), '1'.repeat(21), '1', '']])).toEqual([]);
    expect(propuestaDeFinca({ animales: {} }, 'FINCA ' + 'A'.repeat(200)).nombre).toHaveLength(80);
  });

  it('un archivo cortado se reconoce como Excel dañado', async () => {
    const entero = new Uint8Array(await xlsx({ 'xl/worksheets/sheet1.xml': '<worksheet/>' }));
    await expect(leerXlsx(entero.slice(0, 40).buffer)).rejects.toThrow('dañado o incompleto');
  });

  it('un «Total» que no es entero no rompe nada: la entrega queda sin lista', () => {
    const cabecera = ['NombreEstablecimiento', 'Rango Inicial', 'Rango Final', 'Total', 'Fecha'];
    const r = rangosDeSenasa([cabecera, ['X', '999000000001', '999000000002', '2.5', ''], ['X', '999000000003', '999000000004', '1e999', '']]);
    expect(r.map(x => x.total)).toEqual([0, 0]);
    expect(planSenasa({ animales: {} }, r).omitidas.map(o => o.motivo)).toEqual(['sin-lista', 'sin-lista']);
  });

  const R = (finca: string, inicio: string, fin: string, total: number) => ({ finca, inicio, fin, total, fecha: '' });
  const cabecera = ['NombreEstablecimiento', 'Rango Inicial', 'Rango Final', 'Total', 'Fecha'];

  it('planificar dos veces el mismo Excel: la segunda vez no hay nada nuevo', () => {
    const db: Db = { animales: {} }, rangos = [R('X', '999000000001', '999000000003', 3)];
    agregarSenasa(db, rangos, { X: { nombre: 'Norte', tipo: 'carne' } });
    expect(planSenasa(db, rangos)).toMatchObject({ nuevos: 0, sinFinca: 0, omitidas: [] });
  });

  it('una errata de 13 dígitos no deja fuera los de 12: se avisa sola, con su motivo', () => {
    const r = planSenasa({ animales: {} }, [R('X', '999000000001', '999000000002', 2), R('X', '999000000003', '999000000004', 2), R('X', '9990000000050', '9990000000050', 1)]);
    expect(r.nuevos).toBe(4);
    expect(r.omitidas.map(o => o.motivo)).toEqual(['largo-raro']);
  });

  it('con la app vacía, el largo normal sale del Excel', () => {
    expect(planSenasa({ animales: {} }, [R('X', '058412300001', '058412300002', 2)]).nuevos).toBe(2);
  });

  it('más de 1000 entregas es demasiado; el nombre de la finca se corta a 80', () => {
    const filas = Array.from({ length: 1001 }, (_, k) => ['X', String(999000000000 + k), String(999000000000 + k), '1', '']);
    expect(() => rangosDeSenasa([cabecera, ...filas])).toThrow('demasiado grande');
    expect(rangosDeSenasa([cabecera, ['F'.repeat(200), '999000000001', '999000000001', '1', '']])[0].finca).toHaveLength(80);
  });

  it('el plan con 1000 entregas omitidas y 5000 animales es rápido', () => {
    const db: Db = { animales: Object.fromEntries(Array.from({ length: 5000 }, (_, k) => { const a = String(999000000000 + k); return [a, { arete: a, nombre: '', tipo: 'carne' as const, nac: '', finca: 'N', sexo: 'H', raza: '', categoria: '', notas: '', eventos: [] }] })) };
    const rangos = Array.from({ length: 1000 }, (_, k) => R('X', String(999000000000 + k * 10), String(999000000000 + k * 10 + 9), 3)); // sin lista
    const t0 = Date.now();
    expect(planSenasa(db, rangos).omitidas).toHaveLength(1000);
    expect(Date.now() - t0).toBeLessThan(500);
  });
});
