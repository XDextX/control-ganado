// Pantallas de códigos QR: mostrar el de un animal o del corral, pasar lo anotado y escanear.
import { h, Fragment } from '../jsx';
import { areteValido, cambiosDesde, cuantos, fusionar, hoy, sumarDias } from '../datos';
import { abrir, avisar, est, guardarYAvisar, ir, render, verEjemplo, volver } from '../estado';
import { Escaner, ImagenQr, interpretar, qrDeAnimal, qrDeDatos } from '../qr';

export function VerQr() {
  const a = est.actual!, corral = est.qrModo === 'corral';
  return (
    <section>
      <div class="noprint"><button onClick={() => ir('animal')}>← Volver</button></div>
      <div class="card" style="text-align:center">
        <h2>{corral ? 'Arete' : 'Pasar animal'} {a.arete}{a.nombre ? ' · ' + a.nombre : ''}</h2>
        <ImagenQr texto={corral ? a.arete : qrDeAnimal(a)} />
        <p class="noprint">{corral
          ? 'Imprima este código y péguelo en el corral o junto al arete. Al escanearlo con la app se abre la ficha del animal.'
          : 'En el otro teléfono abra la app, toque “📷 Escanear código QR” y apunte a esta pantalla. Se suman los datos sin borrar nada.'}</p>
      </div>
      {corral && <button class="grande noprint" onClick={() => print()}>🖨️ Imprimir código</button>}
    </section>
  );
}

function leerQr(texto: string) {
  let l;
  try { l = interpretar(texto) } catch { alert('El código QR no se pudo leer. Intente de nuevo.'); return ir('escaner') }
  if (l.tipo === 'animal') {
    if (est.ejemplo) verEjemplo(false); // lo recibido es real: no se junta con el ejemplo, que no se guarda
    try {
      const n = fusionar(est.db, l.datos);
      if (!guardarYAvisar()) return ir('lista');
      alert(`Listo. Se agregaron ${cuantos(n.animales, 'animal nuevo', 'animales nuevos')} y ${cuantos(n.eventos, 'evento nuevo', 'eventos nuevos')}.\n\nNo se borró nada.${n.descartados ? (n.descartados === 1 ? '\n\nSe ignoró 1 dato dañado que venía mal escrito.' : `\n\nSe ignoraron ${n.descartados} datos dañados que venían mal escritos.`) : ''}`);
      const aretes = Object.values((l.datos as { animales: Record<string, { arete: string }> }).animales).map(a => a.arete.trim());
      return aretes.length === 1 && Object.hasOwn(est.db.animales, aretes[0]) ? abrir(aretes[0]) : volver();
    } catch (e) { alert('Este código no es de la app de ganado. ' + (e as Error).message); return ir('lista') }
  }
  if (!areteValido(l.arete)) { alert('Este código QR no es de un arete ni de la app de ganado.'); return ir('lista') }
  if (Object.hasOwn(est.db.animales, l.arete)) return abrir(l.arete);
  // Arete nuevo: se abre el alta ya con el número puesto (si no quiere, toca Volver). Sin ventanita de confirmación.
  est.nuevo = { arete: l.arete.trim() }; abrir(null); est.nuevo = {};
  avisar(`Arete ${l.arete.trim()} no registrado: complete el alta`);
}

export function VerEscaner() {
  return (
    <section>
      <button onClick={volver}>← Volver</button>
      <h2>Escanear código QR</h2>
      <Escaner alLeer={leerQr} reintentar={render} />
    </section>
  );
}

export function VerCambios() {
  const desde = sumarDias(hoy(), -est.cambiosDias), d = cambiosDesde(est.db, desde);
  const animales = Object.values(d.animales), eventos = animales.reduce((n, a) => n + a.eventos.length, 0);
  const nuevos = animales.filter(a => a.creado && a.creado >= desde).length;
  const resumen = [nuevos && cuantos(nuevos, 'animal nuevo', 'animales nuevos'), eventos && cuantos(eventos, 'cosa anotada', 'cosas anotadas')].filter(Boolean).join(' y ');
  const opcion = (dias: number, texto: string, estilo = '') =>
    <button style={estilo} aria-pressed={String(est.cambiosDias === dias)} onClick={() => { est.cambiosDias = dias; render() }}>{texto}</button>;
  return (
    <section>
      <button onClick={volver}>← Volver</button>
      <h2>Pasar lo anotado a otro teléfono</h2>
      <p>¿Qué quiere pasar?</p>
      <div class="eventos">
        {opcion(0, 'Lo de hoy')}
        {opcion(1, 'Desde ayer')}
        {opcion(6, 'Últimos 7 días', 'grid-column:1/-1')}
      </div>
      <div class="card" style="text-align:center">
        {animales.length ? <>
          <p><b>Incluye: {resumen}</b></p>
          <ImagenQr texto={qrDeDatos(d)} />
          <p>En el otro teléfono abra la app, toque <b>“📷 Escanear código QR”</b> y apunte a esta pantalla. Se suma sin borrar nada.</p>
        </> : <p>No hay nada anotado en este teléfono {est.cambiosDias ? 'en esos días' : 'hoy'}.</p>}
      </div>
    </section>
  );
}
