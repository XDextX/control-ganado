import { describe, expect, it, vi } from 'vitest';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { Animal, Db, fusionar } from './datos';
// @ts-expect-error pngjs llega con qrcode y no trae tipos
import { PNG } from 'pngjs';
import { MAX_PARTES, OPCIONES_QR, PREFIJO, faltan, interpretar, juntarPartes, leerParte, partesQr, sumarParte, vigente } from './qr';
import { SinSoporte, copiaComprimida, leerCopia } from './comprimir';

const vaca: Animal = { arete: '999000000049', nombre: 'Lucera', tipo: 'leche', nac: '2020-10-13', finca: 'El Roble', sexo: 'H',
  raza: 'Jersey', categoria: 'Vaca', notas: '', eventos: [{ id: 'm1abc', tipo: 'monta', fecha: '2026-03-01', nota: 'Toro Pinto' }] };

const deUno = (a: Animal): Db => ({ animales: { [a.arete]: a } });
const leer = async (partes: Uint8Array[]) => juntarPartes(partes.map(p => leerParte(p)!).sort((x, y) => x.i - y.i).map(p => p.trozo));
// Eventos con id al azar, como los reales (no se comprimen).
const muchos = (n: number) => Array.from({ length: n }, (_, i) => ({ id: Math.random().toString(36).slice(2, 10), tipo: 'pesaje' as const, fecha: `2026-${String(1 + i % 12).padStart(2, '0')}-${String(1 + i % 28).padStart(2, '0')}`, nota: '', am: 10 + i % 7, pm: 8 + i % 5 }));

describe('QR', () => {
  it('un animal ida y vuelta se suma al otro teléfono', async () => {
    const partes = await partesQr(deUno(vaca));
    expect(partes).toHaveLength(1);
    const otro: Db = { animales: {} };
    expect(fusionar(otro, await leer(partes))).toEqual({ animales: 1, eventos: 1, descartados: 0 });
    expect(otro.animales[vaca.arete].finca).toBe('El Roble');
  });
  it('los QR viejos (GANADO1) se siguen leyendo', () => {
    expect(interpretar(PREFIJO + JSON.stringify(deUno(vaca)))).toEqual({ tipo: 'animal', datos: deUno(vaca) });
  });
  it('cualquier otro texto es un arete', () => {
    expect(interpretar(' 999000000001 \n')).toEqual({ tipo: 'arete', arete: '999000000001' });
    expect(leerParte(new TextEncoder().encode('999000000001'))).toBeNull();
  });
  it('un animal con 150 pesajes cabe en un QR', async () => {
    const partes = await partesQr(deUno({ ...vaca, eventos: muchos(150) }));
    expect(partes).toHaveLength(1);
    await expect(QRCode.toString([{ data: partes[0], mode: 'byte' }], { errorCorrectionLevel: 'L' })).resolves.toBeTruthy();
  });
  it('si no cabe, se reparte en varios códigos que se juntan en cualquier orden', async () => {
    const d = deUno({ ...vaca, eventos: muchos(600) });
    const partes = await partesQr(d);
    expect(partes.length).toBeGreaterThan(1);
    expect(partes.length).toBeLessThanOrEqual(MAX_PARTES);
    for (const p of partes) await expect(QRCode.toString([{ data: p, mode: 'byte' }], { errorCorrectionLevel: 'L' })).resolves.toBeTruthy();
    expect(await leer([...partes].reverse())).toEqual(d);
  });
  it('una parte dañada no se toma como parte', () => {
    expect(leerParte(Uint8Array.of(71, 78, 50, 0, 1, 3, 2, 9))).toBeNull(); // parte 3 de 2
    expect(leerParte(Uint8Array.of(71, 78, 50, 0, 1, 1, 9, 9))).toBeNull(); // más de 5 partes
  });
});

describe('copia comprimida', () => {
  it('ida y vuelta, y las copias viejas se leen igual', async () => {
    const json = JSON.stringify(deUno({ ...vaca, eventos: muchos(300) }));
    const c = await copiaComprimida(json);
    expect(c.length).toBeLessThan(json.length / 2);
    expect(await leerCopia(c, 2 ** 20)).toBe(json);
    expect(await leerCopia('  ' + json + '\n', 2 ** 20)).toBe(json);
  });
  it('una copia cortada o que se infla demasiado se rechaza', async () => {
    const c = await copiaComprimida('x'.repeat(100000));
    await expect(leerCopia(c.slice(0, 20), 2 ** 20)).rejects.toBeInstanceOf(SyntaxError);
    await expect(leerCopia(c, 1000)).rejects.toBeInstanceOf(RangeError);
  });
});

// Pinta el QR como lo vería la cámara (4 px por cuadrito, con margen) y lo lee con jsQR, igual que el escáner.
function porCamara(parte: Uint8Array) {
  const { modules } = QRCode.create([{ data: parte, mode: 'byte' }], { errorCorrectionLevel: 'L' });
  const px = 4, borde = 4, lado = (modules.size + 2 * borde) * px, img = new Uint8ClampedArray(lado * lado * 4).fill(255);
  for (let y = 0; y < modules.size; y++) for (let x = 0; x < modules.size; x++) if (modules.get(y, x))
    for (let dy = 0; dy < px; dy++) for (let dx = 0; dx < px; dx++) {
      const o = (((y + borde) * px + dy) * lado + (x + borde) * px + dx) * 4; img[o] = img[o + 1] = img[o + 2] = 0;
    }
  return jsQR(img, lado, lado)!.binaryData;
}

describe('QR en varias partes, de punta a punta', () => {
  it('imagen → cámara → partes → datos, armado como en el escáner', async () => {
    const d = deUno({ ...vaca, eventos: muchos(600) });
    const partes = await partesQr(d);
    expect(partes.length).toBeGreaterThan(1);
    let envio = null;
    for (const p of [...partes].reverse()) {
      const leida = leerParte(porCamara(p))!;
      expect(leida).not.toBeNull();
      envio = sumarParte(envio, leida).envio;
      expect(sumarParte(envio, leida).nueva).toBe(false); // el mismo código otra vez no cuenta
    }
    expect(faltan(envio)).toEqual([]);
    expect(await juntarPartes(envio!.trozos as Uint8Array[])).toEqual(d);
  });
  it('la imagen que pinta la app (OPCIONES_QR) se lee con jsQR', async () => {
    const partes = await partesQr(deUno({ ...vaca, eventos: muchos(600) }));
    for (const p of partes) {
      const png = PNG.sync.read(await QRCode.toBuffer([{ data: p, mode: 'byte' }], OPCIONES_QR));
      expect(leerParte(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)!.binaryData)).toEqual(leerParte(p));
    }
  });
  it('el mismo envío da los mismos códigos; otro envío empieza de cero', async () => {
    const [a] = await partesQr(deUno(vaca)), [b] = await partesQr(deUno(vaca)), [c] = await partesQr(deUno({ ...vaca, nombre: 'Otra' }));
    expect(a).toEqual(b);
    const e1 = sumarParte(null, { ...leerParte(a)!, n: 2 }).envio;
    expect(faltan(e1)).toEqual([2]);
    expect(faltan(sumarParte(e1, leerParte(c)!).envio)).toEqual([]);
  });
  it('un envío a medias de hace más de 10 minutos se olvida', () => {
    const e = sumarParte(null, { id: 1, i: 1, n: 2, trozo: Uint8Array.of(1) }, 0).envio;
    expect(vigente(e, 9 * 60e3)).toBe(e);
    expect(vigente(e, 11 * 60e3)).toBeNull();
  });
  it('un byte cambiado se detecta (suma de control)', async () => {
    const [p] = await partesQr(deUno({ ...vaca, eventos: muchos(50) }));
    const t = leerParte(p)!.trozo; t[t.length - 10] ^= 1;
    await expect(juntarPartes([t])).rejects.toThrow();
  });
});

describe('teléfono sin compresor', () => {
  it('la copia sale sin comprimir y una comprimida avisa claro', async () => {
    const c = await copiaComprimida('{"animales":{}}');
    vi.stubGlobal('CompressionStream', undefined); vi.stubGlobal('DecompressionStream', undefined);
    try {
      expect(await copiaComprimida('{"animales":{}}')).toBe('{"animales":{}}');
      await expect(leerCopia(c, 2 ** 20)).rejects.toBeInstanceOf(SinSoporte);
    } finally { vi.unstubAllGlobals() }
  });
});
