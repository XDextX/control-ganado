// Planilla del día de pesaje: todas las vacas de leche de una finca, con mañana y tarde en kilos.
import { h, Fragment } from '../jsx';
import { MAX_KILOS, cuantos, fincas, guardar, guardarPesajes, hoy, kilos, leerKilos, pesajeDe, vacasDeLeche } from '../datos';
import { avisar, est, mostrarReporte, render, volver } from '../estado';
import { NombreYArete } from '../componentes/Arete';

let finca = '', fecha = '';

// Fincas que tienen vacas de leche para pesar.
const fincasDeLeche = () => fincas(est.db).filter(f => vacasDeLeche(est.db, f).length);

export function Pesaje() {
  const lista = fincasDeLeche();
  if (!lista.includes(finca)) finca = lista[0] ?? '';
  fecha ||= hoy();
  const vacas = vacasDeLeche(est.db, finca);
  const filas: { arete: string; am: HTMLInputElement; pm: HTMLInputElement; total: HTMLElement }[] = [];
  let resumen!: HTMLElement;

  const valor = (i: HTMLInputElement) => { const n = leerKilos(i.value); i.classList.toggle('malo', Number.isNaN(n)); return n };
  const recalcular = () => {
    let suma = 0, pesadas = 0;
    for (const f of filas) {
      const am = valor(f.am), pm = valor(f.pm);
      const t = (Number.isNaN(am) ? 0 : am ?? 0) + (Number.isNaN(pm) ? 0 : pm ?? 0);
      f.total.textContent = am === undefined && pm === undefined ? '' : '= ' + kilos(t);
      if (t) { suma += t; pesadas++ }
    }
    resumen.textContent = pesadas ? `${cuantos(pesadas, 'vaca pesada', 'vacas pesadas')} · total ${kilos(suma)} · promedio ${kilos(suma / pesadas)}` : 'Todavía no hay pesos anotados.';
  };
  const guardarTodo = () => {
    const malos = filas.filter(f => Number.isNaN(valor(f.am)) || Number.isNaN(valor(f.pm)));
    if (malos.length) return alert(`Revise los números en rojo (${malos.length}). Use solo números, por ejemplo 12,5. Máximo ${MAX_KILOS} kg por ordeño.`);
    const n = guardarPesajes(est.db, fecha, filas.map(f => ({ arete: f.arete, am: valor(f.am), pm: valor(f.pm) })));
    guardar(est.db); avisar(`✅ Pesaje guardado: ${cuantos(n, 'vaca', 'vacas')}`);
    est.mes = fecha.slice(0, 7); est.fechaPesaje = fecha; mostrarReporte('pesajes');
  };

  return (
    <section>
      <button onClick={volver}>← Volver</button>
      <h2>🥛 Pesaje de leche</h2>
      {!lista.length ? <p>No hay vacas de leche registradas. Para pesarlas, en su ficha el <b>Tipo</b> debe ser “Leche” y la categoría “Vaca”.</p> : <>
        <label for="p-finca">Finca</label>
        <select id="p-finca" value={finca} onChange={(e: Event) => { finca = (e.target as HTMLSelectElement).value; render() }}>
          {lista.map(f => <option>{f}</option>)}
        </select>
        <label for="p-fecha">Fecha del pesaje</label>
        <input id="p-fecha" type="date" value={fecha} onChange={(e: Event) => { fecha = (e.target as HTMLInputElement).value || hoy(); render() }} />
        <p class="ayuda">Anote los kilos de cada ordeño. Deje en blanco la vaca que no se pesó. Si ya había pesaje ese día, aquí aparece para corregirlo.</p>
        {vacas.map(({ a, seca }) => {
          const p = pesajeDe(a, fecha);
          let am!: HTMLInputElement, pm!: HTMLInputElement, total!: HTMLElement;
          const fila = (
            <div class={'card pesaje' + (seca ? ' seca' : '')}>
              <div><NombreYArete nombre={a.nombre} arete={a.arete} />{seca && <span class="tag">Seca</span>} <b class="total" ref={(el: HTMLElement) => (total = el)}></b></div>
              <div class="fila">
                <label>☀️ Mañana (kg)<input inputmode="decimal" value={String(p?.am ?? '').replace('.', ',')} ref={(el: HTMLInputElement) => (am = el)} onInput={recalcular} /></label>
                <label>🌙 Tarde (kg)<input inputmode="decimal" value={String(p?.pm ?? '').replace('.', ',')} ref={(el: HTMLInputElement) => (pm = el)} onInput={recalcular} /></label>
              </div>
            </div>
          );
          filas.push({ arete: a.arete, am, pm, total });
          return fila;
        })}
        <p class="card"><b ref={(el: HTMLElement) => { resumen = el; queueMicrotask(recalcular) }}></b></p>
        <button class="pri grande" onClick={guardarTodo}>💾 Guardar pesaje</button>
      </>}
    </section>
  );
}
