import { afterEach, describe, expect, it, vi } from 'vitest';
import { pesajes, traslados } from './reportes';
import { Animal, Db, KEY, alertas, cargar, esRepeticion, guardar, textoEvento, anotadoEl, limpiarAnimal, cambiosDesde, diceBorrar, edad, esRaro, fusionar, guardarPesajes, leerKilos, pesajeDe, prenezAbierta, sumarDias, totalPesaje, trasladar, vacasDeLeche } from './datos';

const vaca = (tipo: 'leche' | 'carne', eventos: Animal['eventos']): Animal =>
  ({ arete: 'X', nombre: '', tipo, nac: '', finca: '', sexo: 'H', raza: '', categoria: '', notas: '', eventos });

describe('fechas del hato', () => {
  it('parto = monta + 283 días; secado 60 días antes solo en leche', () => {
    expect(sumarDias('2026-01-01', 283)).toBe('2026-10-11');
    expect(prenezAbierta(vaca('leche', [{ id: 'a', tipo: 'monta', fecha: '2026-01-01', nota: '' }]))).toEqual({ parto: '2026-10-11', secado: '2026-08-12' });
    expect(prenezAbierta(vaca('carne', [{ id: 'a', tipo: 'monta', fecha: '2026-01-01', nota: '' }]))!.secado).toBeNull();
  });
  it('el parto o el aborto cierran la preñez', () => {
    expect(prenezAbierta(vaca('carne', [
      { id: 'a', tipo: 'monta', fecha: '2026-01-01', nota: '' }, { id: 'b', tipo: 'parto', fecha: '2026-10-10', nota: '' }]))).toBeNull();
    expect(prenezAbierta(vaca('carne', [
      { id: 'a', tipo: 'monta', fecha: '2026-01-01', nota: '' }, { id: 'b', tipo: 'aborto', fecha: '2026-03-10', nota: '' }]))).toBeNull();
  });
  it('alerta de secado desaparece al anotar el secado', () => {
    const db: Db = { animales: { X: vaca('leche', [{ id: 'a', tipo: 'monta', fecha: '2026-01-01', nota: '' }]) } };
    expect(alertas(db, '2026-08-01').map(x => x.que)).toEqual(['Secar']);
    db.animales.X.eventos.push({ id: 'b', tipo: 'secado', fecha: '2026-08-12', nota: '' });
    expect(alertas(db, '2026-09-20').map(x => x.que)).toEqual(['Parto probable']);
  });
  it('edad legible', () => {
    expect(edad('2025-10-26', '2026-10-26')).toBe('1 año');
    expect(edad('2020-10-13', '2026-10-26')).toBe('6 años');
    expect(edad('2026-05-13', '2026-10-26')).toBe('5 meses');
  });
});

describe('lo anotado desde una fecha', () => {
  const id = (fecha: string) => new Date(fecha + 'T15:00:00').getTime().toString(36) + 'abcd';
  it('incluye solo eventos registrados desde ese día y animales dados de alta desde ese día', () => {
    const db: Db = { animales: {
      X: vaca('leche', [{ id: id('2026-10-20'), tipo: 'celo', fecha: '2026-10-20', nota: '' }, { id: id('2026-10-26'), tipo: 'monta', fecha: '2026-10-25', nota: '' }]),
      Y: { ...vaca('carne', []), arete: 'Y', creado: '2026-10-26' },
      Z: { ...vaca('carne', [{ id: id('2026-10-01'), tipo: 'celo', fecha: '2026-10-01', nota: '' }]), arete: 'Z' },
    } };
    const d = cambiosDesde(db, '2026-10-26');
    expect(Object.keys(d.animales).sort()).toEqual(['X', 'Y']);
    expect(d.animales.X.eventos.map(e => e.tipo)).toEqual(['monta']);
    expect('nombre' in d.animales.X).toBe(false); // campos vacíos fuera, para que quepa en el QR
    const otro: Db = { animales: {} };
    expect(fusionar(otro, d)).toEqual({ animales: 2, eventos: 1, descartados: 0 });
  });
  it('los ids viejos o raros no rompen nada', () => {
    expect(anotadoEl({ id: 'zz', tipo: 'celo', fecha: '2026-01-01', nota: '' })).toBe('');
  });
});

describe('importar respaldo', () => {
  it('suma animales y eventos sin borrar ni duplicar', () => {
    const db: Db = { animales: { X: { ...vaca('leche', [{ id: '1', tipo: 'celo', fecha: '2026-01-01', nota: '' }]), nombre: 'propio' } } };
    const n = fusionar(db, { animales: {
      X: { ...vaca('leche', [{ id: '1', tipo: 'celo', fecha: '2026-01-01', nota: '' }, { id: '2', tipo: 'monta', fecha: '2026-01-02', nota: '' }]), nombre: 'otro' },
      Y: { ...vaca('carne', []), arete: 'Y' } } });
    expect(n).toEqual({ animales: 1, eventos: 1, descartados: 0 });
    expect(db.animales.X.eventos).toHaveLength(2);
    expect(db.animales.X.nombre).toBe('propio');
  });
  it('rechaza archivos que no son respaldo', () => {
    expect(() => fusionar({ animales: {} }, { hola: 1 })).toThrow();
    expect(() => fusionar({ animales: {} }, { animales: { X: { arete: 'X' } } })).toThrow();
  });
});

describe('traslados', () => {
  it('cambia la finca y deja el traslado en el historial', () => {
    const a = { ...vaca('carne', []), finca: 'La Esperanza' };
    trasladar(a, 'El Roble', '2026-10-27', 'en camión');
    expect(a.finca).toBe('El Roble');
    expect(a.eventos[0]).toMatchObject({ tipo: 'traslado', desde: 'La Esperanza', hacia: 'El Roble', fecha: '2026-10-27' });
  });
  it('un traslado que llega por copia o QR mueve el animal en este teléfono', () => {
    const aqui: Db = { animales: { X: { ...vaca('carne', []), finca: 'La Esperanza' } } };
    const otro = { ...vaca('carne', []), finca: 'La Esperanza' };
    trasladar(otro, 'El Roble', '2026-10-27');
    fusionar(aqui, { animales: { X: otro } });
    expect(aqui.animales.X.finca).toBe('El Roble');
  });
  it('completa los datos vacíos con la copia, sin pisar lo ya escrito', () => {
    const aqui: Db = { animales: { X: { ...vaca('leche', []), nombre: '', raza: 'Jersey' } } };
    fusionar(aqui, { animales: { X: { ...vaca('leche', []), nombre: 'Pinta', raza: 'Holstein' } } });
    expect(aqui.animales.X).toMatchObject({ nombre: 'Pinta', raza: 'Jersey' });
  });
  it('sin traslado nuevo, respeta la finca que se cambió a mano en este teléfono', () => {
    const aqui: Db = { animales: { X: { ...vaca('carne', []), finca: 'La Esperanza' } } };
    trasladar(aqui.animales.X, 'Norte', '2026-10-01');
    aqui.animales.X.finca = 'Sur'; // corregida en "Cambiar datos del animal"
    fusionar(aqui, JSON.parse(JSON.stringify({ animales: { X: { ...aqui.animales.X, eventos: [...aqui.animales.X.eventos, { id: 'zz1', tipo: 'celo', fecha: '2026-10-20', nota: '' }] } } })));
    expect(aqui.animales.X.finca).toBe('Sur');
  });
});

describe('confirmar borrado', () => {
  it('acepta BORRAR aunque el teclado agregue puntos, espacios, minúsculas o tildes', () => {
    for (const t of ['BORRAR', 'borrar', ' Borrar. ', 'Bórrar', 'BORRAR!']) expect(diceBorrar(t)).toBe(true);
    for (const t of ['', 'borra', 'borrar todo', 'no']) expect(diceBorrar(t)).toBe(false);
  });
});

describe('reporte de traslados', () => {
  it('lista los traslados del mes y resume por ruta', () => {
    const db: Db = { animales: { X: { ...vaca('carne', []), finca: 'La Esperanza' }, Y: { ...vaca('carne', []), arete: 'Y', finca: 'La Esperanza' } } };
    trasladar(db.animales.X, 'El Roble', '2026-10-05');
    trasladar(db.animales.Y, 'El Roble', '2026-10-06');
    trasladar(db.animales.Y, 'La Esperanza', '2026-11-01');
    const r = traslados(db, '2026-10');
    expect(r.sub).toBe('2 animales trasladados');
    expect(r.secciones[0].nota).toBe('2 de La Esperanza a El Roble');
    expect(r.secciones[0].filas.map(f => f[1])).toEqual(['X', 'Y']);
  });
});

describe('pesajes de leche', () => {
  it('lee kilos con coma o punto y rechaza lo que no tiene sentido', () => {
    expect(leerKilos('12,5')).toBe(12.5);
    expect(leerKilos(' 9 ')).toBe(9);
    expect(leerKilos('')).toBeUndefined();
    expect(leerKilos('abc')).toBeNaN();
    expect(leerKilos('125')).toBeNaN(); // más de MAX_KILOS por ordeño
  });
  it('solo cuenta vacas de leche activas de la finca y marca las secas', () => {
    const db: Db = { animales: {
      V: { ...vaca('leche', [{ id: '1', tipo: 'parto', fecha: '2026-01-01', nota: '' }]), arete: 'V', finca: 'P', categoria: 'Vaca' },
      S: { ...vaca('leche', [{ id: '1', tipo: 'parto', fecha: '2025-01-01', nota: '' }, { id: '2', tipo: 'secado', fecha: '2026-08-01', nota: '' }]), arete: 'S', finca: 'P' },
      T: { ...vaca('leche', []), arete: 'T', finca: 'P', categoria: 'Ternera' },
      C: { ...vaca('carne', []), arete: 'C', finca: 'P' },
      O: { ...vaca('leche', []), arete: 'O', finca: 'Otra' },
    } };
    expect(vacasDeLeche(db, 'P').map(x => x.a.arete + (x.seca ? '(seca)' : ''))).toEqual(['S(seca)', 'V']);
  });
  it('guarda un pesaje por vaca y día, y al volver a guardar lo reemplaza', () => {
    const db: Db = { animales: { V: { ...vaca('leche', []), arete: 'V' } } };
    expect(guardarPesajes(db, '2026-10-27', [{ arete: 'V', am: 12.5, pm: 10 }])).toBe(1);
    guardarPesajes(db, '2026-10-27', [{ arete: 'V', am: 13, pm: 10 }]);
    expect(db.animales.V.eventos).toHaveLength(1);
    expect(totalPesaje(pesajeDe(db.animales.V, '2026-10-27')!)).toBe(23);
    guardarPesajes(db, '2026-10-27', [{ arete: 'V' }]); // borrar los números = quitar el pesaje
    expect(db.animales.V.eventos).toHaveLength(0);
  });
});

describe('reporte de pesajes', () => {
  it('totales por finca, promedio y cambio contra el pesaje anterior', () => {
    const db: Db = { animales: {
      A: { ...vaca('leche', []), arete: 'A', finca: 'P' },
      B: { ...vaca('leche', []), arete: 'B', finca: 'P' },
    } };
    guardarPesajes(db, '2026-10-20', [{ arete: 'A', am: 10, pm: 8 }]);
    guardarPesajes(db, '2026-10-27', [{ arete: 'A', am: 11, pm: 9 }, { arete: 'B', am: 6, pm: 4 }]);
    const r = pesajes(db, '2026-10-27');
    expect(r.sub).toBe('2 vacas pesadas');
    expect(r.secciones[0].titulo).toBe('P — 30 kg');
    expect(r.secciones[0].filas[0]).toEqual(['A', '11 kg', '9 kg', '20 kg', '▲ 2 kg']);
    expect(r.secciones[0].filas[1][4]).toBe('—');
  });
});

describe('pesaje: aviso de números raros', () => {
  it('marca lo que da más del doble o menos de la mitad que la vez pasada', () => {
    expect(esRaro(51, 15)).toBe(true);
    expect(esRaro(6, 15)).toBe(true);
    expect(esRaro(17, 15)).toBe(false);
    expect(esRaro(12, undefined)).toBe(false); // primer pesaje: nada con qué comparar
    expect(esRaro(undefined, 15)).toBe(false); // vaca no pesada hoy
  });
});

describe('seguridad: lo que entra por copia o QR', () => {
  it('descarta eventos dañados en vez de dejar la app sin abrir', () => {
    const db: Db = { animales: {} };
    const n = fusionar(db, { animales: { X: { arete: 'X', tipo: 'leche', eventos: [
      { id: '1', tipo: 'monta' }, { id: '2', tipo: 'inventado', fecha: '2026-01-01' }, { id: '3', tipo: 'celo', fecha: '2026-01-05', nota: 'ok' }] } } });
    expect(n.descartados).toBe(2);
    expect(db.animales.X.eventos.map(e => e.id)).toEqual(['3']);
    expect(() => alertas(db)).not.toThrow();
  });
  it('rechaza aretes reservados sin tocar el objeto de datos', () => {
    const db: Db = { animales: {} };
    expect(() => fusionar(db, JSON.parse('{"animales":{"a":{"arete":"__proto__","eventos":[]}}}'))).toThrow('mal formado');
    expect(Object.getPrototypeOf(db.animales)).toBe(Object.prototype);
    expect(Object.keys(db.animales)).toEqual([]);
  });
  it('si un animal está mal, no importa nada (nunca una copia a medias)', () => {
    const db: Db = { animales: {} };
    expect(() => fusionar(db, { animales: { A: { arete: 'A', eventos: [] }, B: { arete: '', eventos: [] } } })).toThrow();
    expect(db.animales).toEqual({});
  });
  it('limpia tipos raros: textos muy largos, kilos imposibles, campos que no son texto', () => {
    const l = limpiarAnimal({ arete: ' 77 ', nombre: { malo: 1 }, tipo: 'cualquiera', notas: 'x'.repeat(5000),
      eventos: [{ id: 'p', tipo: 'pesaje', fecha: '2026-01-01', nota: '', am: 9999, pm: 10 }] })!;
    expect(l.animal.arete).toBe('77');
    expect(l.animal.nombre).toBe('');
    expect(l.animal.tipo).toBe('leche');
    expect(l.animal.notas).toHaveLength(1000);
    expect(l.animal.eventos[0]).toMatchObject({ am: undefined, pm: 10 });
  });
});

describe('revisión 2026-10-30', () => {
  const guardado = (crudo: string) => {
    const m = new Map([[KEY, crudo]]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => m.set(k, v) });
    const alerta = vi.fn(); vi.stubGlobal('alert', alerta);
    return { m, alerta };
  };
  afterEach(() => vi.unstubAllGlobals());

  it('al cargar, lo que no pasa la validación queda rescatado y se avisa', () => {
    const crudo = JSON.stringify({ animales: {
      A: { arete: 'A', eventos: [{ id: '1', tipo: 'celo', fecha: '2026-01-01' }, { tipo: 'celo' }], notas: 'x'.repeat(1500) },
      B: { arete: 'B' },
    } });
    const { m, alerta } = guardado(crudo);
    const db = cargar();
    expect(Object.keys(db.animales)).toEqual(['A']);
    expect([...m.entries()].find(([k]) => k.startsWith(KEY + '.danado-'))?.[1]).toBe(crudo);
    expect(alerta).toHaveBeenCalledOnce();
    // No se repite en cada apertura: lo limpio ya quedó guardado.
    cargar();
    expect(alerta).toHaveBeenCalledOnce();
  });
  it('al cargar datos sanos no se rescata ni se avisa nada', () => {
    const { m, alerta } = guardado(JSON.stringify({ animales: { A: { ...vaca('leche', [{ id: '1', tipo: 'celo', fecha: '2026-01-01', nota: '' }]), arete: 'A' } } }));
    cargar();
    expect(m.size).toBe(1);
    expect(alerta).not.toHaveBeenCalled();
  });
  it('guardar dice si de verdad se guardó', () => {
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('lleno') } });
    expect(guardar({ animales: {} })).toBe(false);
  });
  it('un celo después de la monta anula la preñez y queda como repetición', () => {
    const a = vaca('leche', [{ id: '1', tipo: 'monta', fecha: '2026-01-01', nota: '' }, { id: '2', tipo: 'celo', fecha: '2026-01-22', nota: '' }]);
    expect(prenezAbierta(a)).toBeNull();
    expect(esRepeticion(a, a.eventos[1])).toBe(true);
    expect(textoEvento(a.eventos[1], a)).toContain('repetición');
    const b = vaca('leche', [{ id: '1', tipo: 'celo', fecha: '2026-01-01', nota: '' }, { id: '2', tipo: 'monta', fecha: '2026-01-22', nota: '' }]);
    expect(esRepeticion(b, b.eventos[0])).toBe(false);
    expect(prenezAbierta(b)).not.toBeNull();
  });
  it('un macho nunca tiene fecha de parto', () => {
    expect(prenezAbierta({ ...vaca('carne', [{ id: '1', tipo: 'monta', fecha: '2026-01-01', nota: '' }]), sexo: 'M' })).toBeNull();
  });
});
