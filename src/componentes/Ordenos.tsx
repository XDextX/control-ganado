import { h, Fragment } from '../jsx';
import { Evento, kilos } from '../datos';

// Kilos de la mañana y de la tarde, sin que el número se separe de su ícono ni de "kg". El ordeño que no se pesó sale "—".
export function Ordenos({ e }: { e: Pick<Evento, 'am' | 'pm'> }) {
  const kg = (n?: number) => n === undefined ? '—' : kilos(n);
  return <><span class="nw">☀️ {kg(e.am)}</span> · <span class="nw">🌙 {kg(e.pm)}</span></>;
}
