import { h, Fragment } from '../jsx';
import { hoy } from '../datos';
import { Reporte, ficha, inventario, partos, reporteAImagen, salidas } from '../reportes';
import { compartir, est, ir, mostrarReporte, render, volver } from '../estado';

export function MenuReportes() {
  return (
    <section>
      <button onClick={volver}>← Volver</button>
      <h2>¿Qué reporte quiere?</h2>
      <button class="grande" onClick={() => mostrarReporte('inventario')}>🐄 Animales por finca</button>
      <button class="grande" onClick={() => mostrarReporte('partos')}>🍼 Próximos partos y secados</button>
      <button class="grande" onClick={() => mostrarReporte('salidas')}>📤 Salidas del mes (ventas, muertes, bajas)</button>
      <p class="mut">El reporte de un solo animal está dentro de la ficha de cada animal.</p>
    </section>
  );
}

const armar = (): Reporte => est.repTipo === 'ficha' ? ficha(est.actual!) : est.repTipo === 'salidas' ? salidas(est.db, est.mes)
  : est.repTipo === 'partos' ? partos(est.db) : inventario(est.db);

export function VerReporte() {
  const r = armar();
  const enviarFoto = () => reporteAImagen(r).toBlob(async blob => {
    const file = new File([blob!], `reporte-${est.repTipo}-${hoy()}.png`, { type: 'image/png' });
    if (await compartir(file, r.titulo) === 'descargado') alert('Se descargó la imagen del reporte. Puede enviarla por mensaje desde sus descargas.');
  }, 'image/png');
  return (
    <section>
      <div class="noprint">
        <button onClick={() => ir(est.anterior)}>← Volver</button>
        {est.repTipo === 'salidas' && <div><label>Mes</label>
          <input type="month" value={est.mes} onChange={(e: Event) => { est.mes = (e.target as HTMLInputElement).value || hoy().slice(0, 7); render() }} /></div>}
        <button class="pri grande" onClick={enviarFoto}>📲 Enviar como foto (por mensaje)</button>
        <button class="grande" onClick={() => print()}>🖨️ Guardar PDF / Imprimir</button>
      </div>
      <div id="reporte" class="card">
        <h2>{r.titulo}</h2><p class="mut">{r.sub}</p>
        {r.secciones.map(s => <>
          {s.titulo && <h3>{s.titulo}</h3>}
          {s.nota && <p>{s.nota}</p>}
          {s.filas.length > 0 && <table>
            {s.cols.length > 0 && <tr>{s.cols.map(c => <th>{c}</th>)}</tr>}
            {s.filas.map(f => <tr>{f.map((c, i) => <td>{!s.cols.length && i === 0 ? <b>{c}</b> : c}</td>)}</tr>)}
          </table>}
        </>)}
      </div>
    </section>
  );
}
