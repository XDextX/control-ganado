import { h } from '../jsx';

// Los aretes oficiales tienen 12 dígitos, pero en el campo se usan los últimos: esos van en grande.
export function Arete({ arete }: { arete: string }) {
  return arete.length > 4
    ? <span class="arete">{arete.slice(0, -4)}<b>{arete.slice(-4)}</b></span>
    : <span class="arete"><b>{arete}</b></span>;
}

// Nombre primero si tiene (es como lo llaman), luego el arete.
export function NombreYArete({ nombre, arete }: { nombre: string; arete: string }) {
  return nombre ? <span><b>{nombre}</b> · <Arete arete={arete} /></span> : <Arete arete={arete} />;
}
