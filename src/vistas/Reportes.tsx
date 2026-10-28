import { h, Fragment } from '../jsx';
import { fmt, hoy } from '../datos';
import { Reporte, fechasDePesaje, ficha, inventario, partos, pesajes, reporteAImagen, salidas, traslados } from '../reportes';
import { compartir, est, ir, mostrarReporte, render, volver } from '../estado';

export function MenuReportes() {
  verFoto = false; // al elegir otro reporte, empezar por la tabla
  return (
    <section>
      <button onClick={volver}>← Volver</button>
      <h2>¿Qué reporte quiere?</h2>
      <button class="grande" onClick={() => mostrarReporte('inventario')}>🐄 Animales por finca</button>
      <button class="grande" onClick={() => mostrarReporte('partos')}>🍼 Próximos partos y secados</button>
      <button class="grande" onClick={() => mostrarReporte('salidas')}>📤 Salidas del mes (ventas, muertes, bajas)</button>
      <button class="grande" onClick={() => mostrarReporte('traslados')}>🚚 Traslados del mes (entre fincas)</button>
      <button class="grande" onClick={() => mostrarReporte('pesajes')}>🥛 Pesajes de leche</button>
      <p class="mut">El reporte de un solo animal está dentro de la ficha de cada animal.</p>
    </section>
  );
}

const armar = (): Reporte => est.repTipo === 'ficha' ? ficha(est.actual!) : est.repTipo === 'salidas' ? salidas(est.db, est.mes) : est.repTipo === 'traslados' ? traslados(est.db, est.mes) : est.repTipo === 'pesajes' ? pesajes(est.db, est.fechaPesaje || fechasDePesaje(est.db)[0] || hoy())
  : est.repTipo === 'partos' ? partos(est.db) : inventario(est.db);

// Vista previa de la foto: true mientras se muestra la imagen exacta que se va a enviar.
let verFoto = false;

export function VerReporte() {
  const r = armar();
  const enviarFoto = () => reporteAImagen(r).toBlob(async blob => {
    if (!blob) return alert('El teléfono no pudo crear la foto del reporte. Use “Guardar PDF / Imprimir”.');
    const file = new File([blob], `reporte-${est.repTipo}-${hoy()}.png`, { type: 'image/png' });
    if (await compartir(file, r.titulo) === 'descargado') alert('Se descargó la imagen del reporte. Puede enviarla por mensaje desde sus descargas.');
  }, 'image/png');

  if (verFoto) return (
    <section>
      <button onClick={() => { verFoto = false; render() }}>← Volver al reporte</button>
      <h2>👁️ Así se verá la foto</h2>
      <p class="ayuda">Esta es la imagen exacta que se enviará. Si un texto no cabe, termina en “…”.</p>
      <img class="foto-reporte" alt={'Foto del reporte: ' + r.titulo} src={reporteAImagen(r).toDataURL('image/png')} />
      <button class="pri grande" onClick={enviarFoto}>📲 Enviar esta foto (por mensaje)</button>
      <button class="grande" onClick={() => { verFoto = false; render() }}>← Volver al reporte</button>
    </section>
  );

  return (
    <section>
      <div class="noprint">
        <button onClick={() => ir(est.anterior)}>← Volver</button>
        {(est.repTipo === 'salidas' || est.repTipo === 'traslados') && <div><label>Mes</label>
          <input type="month" value={est.mes} onChange={(e: Event) => { est.mes = (e.target as HTMLInputElement).value || hoy().slice(0, 7); render() }} /></div>}
        {est.repTipo === 'pesajes' && fechasDePesaje(est.db).length > 0 && <div><label>Fecha del pesaje</label>
          <select value={est.fechaPesaje || fechasDePesaje(est.db)[0]} onChange={(e: Event) => { est.fechaPesaje = (e.target as HTMLSelectElement).value; render() }}>
            {fechasDePesaje(est.db).map(f => <option value={f}>{fmt(f)}</option>)}
          </select></div>}
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
      <div class="noprint">
        <p class="ayuda">Revise el reporte. Si está bien, envíelo o guárdelo:</p>
        <button class="grande" onClick={() => { verFoto = true; render(); scrollTo(0, 0) }}>👁️ Ver la foto antes de enviar</button>
        <button class="pri grande" onClick={enviarFoto}>📲 Enviar como foto (por mensaje)</button>
        <button class="grande" onClick={() => print()}>🖨️ Guardar PDF / Imprimir</button>
      </div>
    </section>
  );
}
