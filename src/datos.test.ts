import { describe, expect, it } from 'vitest';
import { Animal, Db, alertas, anotadoEl, cambiosDesde, edad, fusionar, prenezAbierta, sumarDias } from './datos';

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
    expect(fusionar(otro, d)).toEqual({ animales: 2, eventos: 1 });
  });
  it('los ids viejos o raros no rompen nada', () => {
    expect(anotadoEl({ id: 'zz', tipo: 'celo', fecha: '2026-01-01', nota: '' })).toBe('');
  });
});

describe('importar respaldo', () => {
  it('suma animales y eventos sin borrar ni duplicar', () => {
    const db: Db = { animales: { X: vaca('leche', [{ id: '1', tipo: 'celo', fecha: '2026-01-01', nota: '' }]) } };
    const n = fusionar(db, { animales: {
      X: { ...vaca('leche', [{ id: '1', tipo: 'celo', fecha: '2026-01-01', nota: '' }, { id: '2', tipo: 'monta', fecha: '2026-01-02', nota: '' }]), nombre: 'otro' },
      Y: { ...vaca('carne', []), arete: 'Y' } } });
    expect(n).toEqual({ animales: 1, eventos: 1 });
    expect(db.animales.X.eventos).toHaveLength(2);
    expect(db.animales.X.nombre).toBe('');
  });
  it('rechaza archivos que no son respaldo', () => {
    expect(() => fusionar({ animales: {} }, { hola: 1 })).toThrow();
    expect(() => fusionar({ animales: {} }, { animales: { X: { arete: 'X' } } })).toThrow();
  });
});
