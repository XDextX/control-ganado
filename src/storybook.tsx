// Catálogo de componentes, solo para desarrollo (npm run dev → /storybook). No entra al build.
// Cada historia prepara `est` con datos de ejemplo y pinta el componente dentro de un marco del ancho de un celular.
import { h, Fragment } from './jsx';
import './estilos.css';
import { Animal, Db } from './datos';
import { alPintar, est } from './estado';
import { Arete, NombreYArete } from './componentes/Arete';
import { Encabezado } from './componentes/Encabezado';
import { AvisoRespaldo, CopiaSeguridad } from './componentes/CopiaSeguridad';
import { ConfirmarBorrado, EliminarAnimal, EliminarDatos } from './componentes/EliminarDatos';
import { Comentarios } from './componentes/Comentarios';
import { ImagenQr } from './qr';
import { Lista } from './vistas/Lista';
import { Ficha } from './vistas/Ficha';
import { VerCambios, VerQr } from './vistas/Codigos';
import { MenuReportes, VerReporte } from './vistas/Reportes';
import { Mover } from './vistas/Mover';
import { Pesaje } from './vistas/Pesaje';

// Nada de lo que se toque aquí debe pisar los datos de desarrollo guardados en este navegador.
Storage.prototype.setItem = () => {};

const hace = (dias: number) => { const d = new Date(); d.setDate(d.getDate() - dias); return d.toISOString().slice(0, 10) };
const id = (dias: number) => (Date.now() - dias * 864e5).toString(36) + 'demo';
const vaca = (arete: string, extra: Partial<Animal> = {}): Animal => ({
  arete, nombre: '', tipo: 'leche', nac: '2020-10-13', finca: 'El Roble', sexo: 'H', raza: 'Jersey', categoria: 'Vaca', notas: '', eventos: [], ...extra,
});

function ejemplo(): Db {
  const animales: Db['animales'] = {
    '999000000049': vaca('999000000049', { nombre: 'Lucera', eventos: [{ id: id(200), tipo: 'monta', fecha: hace(259), nota: 'Toro Pinto' },
      { id: id(7), tipo: 'pesaje', fecha: hace(7), nota: '', am: 11, pm: 9 }, { id: id(0), tipo: 'pesaje', fecha: hace(0), nota: '', am: 12.5, pm: 10 }] }),
    '999000000050': vaca('999000000050', { nombre: 'Canela', eventos: [{ id: id(280), tipo: 'monta', fecha: hace(280), nota: '' }] }),
    '999000000007': vaca('999000000007', { tipo: 'carne', finca: 'La Esperanza', raza: 'Brahman', categoria: 'Novilla / vaquilla',
      eventos: [{ id: id(3), tipo: 'retiro', fecha: hace(3), nota: 'Subasta', motivo: 'Venta' }] }),
    '999000000008': vaca('999000000008', { tipo: 'carne', finca: 'El Roble', raza: 'Brahman', categoria: 'Vaca',
      eventos: [{ id: id(2), tipo: 'traslado', fecha: hace(2), nota: 'En camión', desde: 'La Esperanza', hacia: 'El Roble' }] }),
    '188002916999': vaca('188002916999', { categoria: 'Ternera', nac: hace(0), notas: 'Cría de 999000000049 (Lucera)', creado: hace(0) }),
  };
  for (let i = 0; i < 20; i++) { const a = '1880010204' + String(50 + i); animales[a] = vaca(a, { tipo: 'carne', finca: 'La Esperanza', raza: 'Brahman', categoria: 'Novilla / vaquilla' }) }
  return { animales };
}

// Restablece el estado antes de cada historia, para que no se contaminen entre sí.
function preparar(cambios: Partial<typeof est> = {}) {
  Object.assign(est, { db: ejemplo(), vista: 'lista', anterior: 'lista', actual: null, filtro: { q: '', finca: '', verRet: false },
    pagina: 0, repTipo: 'inventario', mes: hace(0).slice(0, 7), qrModo: 'animal', nuevo: {}, criaDe: '', cambiosDias: 0, fechaPesaje: '' }, cambios);
}
const animal = (arete: string) => est.db.animales[arete];

type Historia = { grupo: string; nombre: string; ver: () => Node };
const HISTORIAS: Historia[] = [
  { grupo: 'Piezas', nombre: 'Arete', ver: () => { preparar(); return <p><Arete arete="999000000049" /> · <Arete arete="0441" /></p> } },
  { grupo: 'Piezas', nombre: 'Nombre y arete', ver: () => { preparar(); return <p><NombreYArete nombre="Lucera" arete="999000000049" /><br /><NombreYArete nombre="" arete="999000000010" /></p> } },
  { grupo: 'Piezas', nombre: 'Encabezado', ver: () => { preparar(); return <Encabezado /> } },
  { grupo: 'Piezas', nombre: 'Aviso de copia', ver: () => { preparar(); return <AvisoRespaldo /> } },
  { grupo: 'Piezas', nombre: 'Copia de seguridad', ver: () => { preparar(); return <CopiaSeguridad /> } },
  { grupo: 'Piezas', nombre: 'Confirmar borrado', ver: () => { preparar(); return <ConfirmarBorrado boton="🗑️ Borrar algo" aviso="Va a borrar algo de prueba." alConfirmar={() => alert('Confirmado (no se borró nada)')} /> } },
  { grupo: 'Piezas', nombre: 'Eliminar datos', ver: () => { preparar(); return <EliminarDatos /> } },
  { grupo: 'Piezas', nombre: 'Eliminar un animal', ver: () => { preparar(); return <EliminarAnimal a={animal('999000000049')} /> } },
  { grupo: 'Piezas', nombre: 'Comentarios', ver: () => { preparar(); return <Comentarios /> } },
  { grupo: 'Piezas', nombre: 'Código QR', ver: () => { preparar(); return <ImagenQr texto="999000000049" /> } },
  { grupo: 'Pantallas', nombre: 'Lista vacía (primera vez)', ver: () => { preparar({ db: { animales: {} } }); return <Lista /> } },
  { grupo: 'Pantallas', nombre: 'Lista con animales', ver: () => { preparar(); return <Lista /> } },
  { grupo: 'Pantallas', nombre: 'Lista buscando “4521”', ver: () => { preparar({ filtro: { q: '4521', finca: '', verRet: false } }); return <Lista /> } },
  { grupo: 'Pantallas', nombre: 'Ficha de una vaca preñada', ver: () => { preparar(); est.actual = animal('999000000049'); return <Ficha /> } },
  { grupo: 'Pantallas', nombre: 'Ficha recién parida (agregar cría)', ver: () => { preparar({ criaDe: '999000000049' }); est.actual = animal('999000000049'); return <Ficha /> } },
  { grupo: 'Pantallas', nombre: 'Ficha de un animal vendido', ver: () => { preparar(); est.actual = animal('999000000007'); return <Ficha /> } },
  { grupo: 'Pantallas', nombre: 'Ficha de un animal trasladado', ver: () => { preparar(); est.actual = animal('999000000008'); return <Ficha /> } },
  { grupo: 'Pantallas', nombre: 'Pesaje de leche (planilla)', ver: () => { preparar(); return <Pesaje /> } },
  { grupo: 'Pantallas', nombre: 'Mover animales', ver: () => { preparar(); return <Mover /> } },
  { grupo: 'Pantallas', nombre: 'Alta de un animal', ver: () => { preparar(); return <Ficha /> } },
  { grupo: 'Pantallas', nombre: 'Alta de una cría (datos puestos)', ver: () => { preparar({ nuevo: { finca: 'El Roble', tipo: 'leche', raza: 'Jersey', nac: hace(0), notas: 'Cría de 999000000049 (Lucera)' } }); return <Ficha /> } },
  { grupo: 'Pantallas', nombre: 'QR para pasar un animal', ver: () => { preparar({ qrModo: 'animal' }); est.actual = animal('999000000049'); return <VerQr /> } },
  { grupo: 'Pantallas', nombre: 'QR del corral', ver: () => { preparar({ qrModo: 'corral' }); est.actual = animal('999000000049'); return <VerQr /> } },
  { grupo: 'Pantallas', nombre: 'Pasar lo anotado', ver: () => { preparar(); return <VerCambios /> } },
  { grupo: 'Pantallas', nombre: 'Menú de reportes', ver: () => { preparar(); return <MenuReportes /> } },
  { grupo: 'Pantallas', nombre: 'Reporte: animales por finca', ver: () => { preparar({ repTipo: 'inventario' }); return <VerReporte /> } },
  { grupo: 'Pantallas', nombre: 'Reporte: traslados del mes', ver: () => { preparar({ repTipo: 'traslados', mes: hace(0).slice(0, 7) }); return <VerReporte /> } },
  { grupo: 'Pantallas', nombre: 'Reporte: pesaje de leche', ver: () => { preparar({ repTipo: 'pesajes' }); return <VerReporte /> } },
  { grupo: 'Pantallas', nombre: 'Reporte: partos y secados', ver: () => { preparar({ repTipo: 'partos' }); return <VerReporte /> } },
];

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const elegida = () => HISTORIAS.find(x => slug(x.nombre) === location.hash.slice(1)) ?? HISTORIAS[0];

function pintar() {
  const actual = elegida();
  const grupos = [...new Set(HISTORIAS.map(x => x.grupo))];
  document.getElementById('app')!.replaceChildren(
    <div class="sb">
      <nav class="sb-menu">
        <h1>🧩 Componentes</h1>
        <p class="ayuda">Solo para desarrollo. Datos de ejemplo; nada se guarda.</p>
        {grupos.map(g => <>
          <h2>{g}</h2>
          {HISTORIAS.filter(x => x.grupo === g).map(x => <a href={'#' + slug(x.nombre)} class={x === actual ? 'activo' : ''}>{x.nombre}</a>)}
        </>)}
      </nav>
      <div class="sb-escenario">
        <h2>{actual.grupo} · {actual.nombre}</h2>
        <div class="sb-celular"><main>{actual.ver()}</main></div>
      </div>
    </div>,
  );
}

// Los botones de las pantallas llaman render(): aquí vuelve a pintar la misma historia (con su estado recién preparado).
alPintar(pintar);
addEventListener('hashchange', pintar);
document.head.append(<style>{`
  .sb{display:flex;min-height:100vh}
  .sb-menu{width:260px;flex:none;padding:16px;border-right:1px solid var(--line);background:var(--card);font-size:16px}
  .sb-menu h1{font-size:1.2rem;margin:0 0 4px}
  .sb-menu h2{font-size:.85rem;text-transform:uppercase;color:var(--mut);margin:18px 0 6px}
  .sb-menu a{display:block;padding:6px 8px;border-radius:8px;color:var(--fg);text-decoration:none}
  .sb-menu a.activo{background:#2f6f3e;color:#fff}
  .sb-escenario{flex:1;padding:16px;overflow:auto}
  .sb-escenario>h2{margin-top:0}
  .sb-celular{width:375px;max-width:100%;border:8px solid #333;border-radius:28px;overflow:hidden;background:var(--bg)}
  @media (max-width:700px){.sb{flex-direction:column}.sb-menu{width:auto;border-right:0;border-bottom:1px solid var(--line)}}
`}</style>);
pintar();
