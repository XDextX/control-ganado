import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import { Animal, Db, fusionar } from './datos';
import { interpretar, qrDeAnimal } from './qr';

const vaca: Animal = { arete: '999000000049', nombre: 'Lucera', tipo: 'leche', nac: '2020-10-13', finca: 'El Roble', sexo: 'H',
  raza: 'Jersey', categoria: 'Vaca', notas: '', eventos: [{ id: 'm1abc', tipo: 'monta', fecha: '2026-03-01', nota: 'Toro Pinto' }] };

describe('QR', () => {
  it('un animal ida y vuelta se suma al otro teléfono', () => {
    const l = interpretar(qrDeAnimal(vaca));
    expect(l.tipo).toBe('animal');
    const otro: Db = { animales: {} };
    expect(fusionar(otro, (l as { datos: unknown }).datos)).toEqual({ animales: 1, eventos: 1, descartados: 0 });
    expect(otro.animales[vaca.arete].finca).toBe('El Roble');
  });
  it('cualquier otro texto es un arete', () => {
    expect(interpretar(' 999000000001 \n')).toEqual({ tipo: 'arete', arete: '999000000001' });
  });
  it('un animal con 25 eventos todavía cabe en un QR', async () => {
    const eventos = Array.from({ length: 25 }, (_, i) => ({ id: 'id' + i + 'xyzw', tipo: 'celo' as const, fecha: '2026-01-01', nota: 'nota corta' }));
    await expect(QRCode.toString(qrDeAnimal({ ...vaca, eventos }), { errorCorrectionLevel: 'L' })).resolves.toBeTruthy();
  });
});
