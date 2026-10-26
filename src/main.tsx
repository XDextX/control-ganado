import { h } from './jsx';
import './estilos.css';
import { alPintar, est, render } from './estado';
import { Encabezado } from './componentes/Encabezado';
import { Lista } from './vistas/Lista';
import { Ficha } from './vistas/Ficha';
import { VerCambios, VerEscaner, VerQr } from './vistas/Codigos';
import { MenuReportes, VerReporte } from './vistas/Reportes';

const VISTAS = { lista: Lista, reportes: MenuReportes, reporte: VerReporte, animal: Ficha, qr: VerQr, escaner: VerEscaner, cambios: VerCambios };
const raiz = document.getElementById('app')!;
alPintar(() => raiz.replaceChildren(<Encabezado />, <main>{VISTAS[est.vista]()}</main>));

render();
// Sin señal en el campo. Solo en producción: en desarrollo el caché estorbaría los cambios.
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('sw.js');
