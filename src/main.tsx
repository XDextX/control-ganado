import { h } from './jsx';
import './estilos.css';
import { alPintar, est, render } from './estado';
import { Encabezado } from './componentes/Encabezado';
import { Lista } from './vistas/Lista';
import { Ficha } from './vistas/Ficha';
import { VerCambios, VerEscaner, VerQr } from './vistas/Codigos';
import { MenuReportes, VerReporte } from './vistas/Reportes';
import { Mover } from './vistas/Mover';
import { Pesaje } from './vistas/Pesaje';

const VISTAS = { lista: Lista, reportes: MenuReportes, reporte: VerReporte, animal: Ficha, qr: VerQr, escaner: VerEscaner, cambios: VerCambios, mover: Mover, pesaje: Pesaje };
const raiz = document.getElementById('app')!;
alPintar(() => raiz.replaceChildren(<Encabezado />, <main>{VISTAS[est.vista]()}</main>));

render();
// Sin señal en el campo. Solo en producción: en desarrollo el caché estorbaría los cambios.
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('sw.js').catch(() => { /* sin service worker (modo privado o navegador limitado): la app funciona igual, solo que necesita señal */ });
