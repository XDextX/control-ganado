import { h, Fragment } from './jsx';
import './estilos.css';
import { alPintar, est, render, verEjemplo } from './estado';
import { Encabezado } from './componentes/Encabezado';
import { Lista } from './vistas/Lista';
import { Ficha } from './vistas/Ficha';
import { VerCambios, VerEscaner, VerQr } from './vistas/Codigos';
import { MenuReportes, VerReporte } from './vistas/Reportes';
import { Mover } from './vistas/Mover';
import { Pesaje } from './vistas/Pesaje';

const VISTAS = { lista: Lista, reportes: MenuReportes, reporte: VerReporte, animal: Ficha, qr: VerQr, escaner: VerEscaner, cambios: VerCambios, mover: Mover, pesaje: Pesaje };
const raiz = document.getElementById('app')!;
alPintar(() => raiz.replaceChildren(<Encabezado />, <>{est.ejemplo && <div class="card warn" role="status">👀 Está viendo un <b>ejemplo</b> con animales inventados. Nada de lo que haga aquí se guarda.<button class="grande" onClick={() => verEjemplo(false)}>✖️ Salir del ejemplo</button></div>}</>, <main tabindex="-1">{VISTAS[est.vista]()}</main>));

render();
// Pide que el navegador no borre los datos cuando le falte espacio. Si no lo concede, todo sigue igual.
navigator.storage?.persist?.().catch(() => {});
// Sin señal en el campo. Solo en producción: en desarrollo el caché estorbaría los cambios.
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('sw.js').catch(() => { /* sin service worker (modo privado o navegador limitado): la app funciona igual, solo que necesita señal */ });
