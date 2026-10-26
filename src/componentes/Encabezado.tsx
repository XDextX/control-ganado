import { h } from '../jsx';
import { render } from '../estado';

// Letra más grande: la elige cada persona en su teléfono.
const LETRA = 'ganado.v1.letra';
function letraGrande(): boolean { try { return localStorage.getItem(LETRA) === '1' } catch { return false } }
function cambiarLetra() {
  const nueva = !letraGrande();
  try { localStorage.setItem(LETRA, nueva ? '1' : '0') } catch { /* sin almacenamiento */ }
  document.documentElement.classList.toggle('letra-grande', nueva); render();
}
document.documentElement.classList.toggle('letra-grande', letraGrande());

export function Encabezado() {
  return (
    <header>
      <h1>🐄 Registro de Ganado</h1>
      <button onClick={cambiarLetra}>{letraGrande() ? '🔍 Letra normal' : '🔍 Letra más grande'}</button>
    </header>
  );
}
