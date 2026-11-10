// Pantallas de códigos QR: mostrar el de un animal o del corral, pasar lo anotado y escanear.
import { h, Fragment } from '../jsx';
import { areteValido, cambiosDesde, cuantos, fusionar, hoy, sumarDias } from '../datos';
import { abrir, avisar, avisarError, est, guardarOVolver, ir, render, verEjemplo, volver } from '../estado';
import { Envio, Escaner, ImagenQr, QrDeDatos, detenerCamara, faltan, interpretar, juntarPartes, leerParte, sumarParte, vigente } from '../qr';
import { SinSoporte } from '../comprimir';

export function VerQr() {
  const a = est.actual!, corral = est.qrModo === 'corral';
  return (
    <section>
      <div class="noprint"><button onClick={() => ir('animal')}>← Volver</button></div>
      <div class="card" style="text-align:center">
        <h2>{corral ? 'Arete' : 'Pasar animal'} {a.arete}{a.nombre ? ' · ' + a.nombre : ''}</h2>
        {corral ? <ImagenQr texto={a.arete} /> : <QrDeDatos datos={{ animales: { [a.arete]: a } }} />}
        <p class="noprint">{corral
          ? 'Imprima este código y péguelo en el corral o junto al arete. Al escanearlo con la app se abre la ficha del animal.'
          : 'En el otro teléfono abra la app, toque “📷 Escanear código QR” y apunte a esta pantalla. Se suman los datos sin borrar nada.'}</p>
      </div>
      {corral && <button class="grande noprint" onClick={() => print()}>🖨️ Imprimir código</button>}
    </section>
  );
}

// Lo recibido por QR se suma a los datos de este teléfono, sin borrar nada.
function recibir(datos: unknown) {
  if (est.ejemplo) verEjemplo(false); // lo recibido es real: no se junta con el ejemplo, que no se guarda
  const antes = JSON.stringify(est.db);
  try {
    const n = fusionar(est.db, datos);
    if (!guardarOVolver(antes, 'lo recibido', () => ir('lista'))) return;
    const aretes = Object.values((datos as { animales: Record<string, { arete: string }> }).animales).map(a => a.arete.trim());
    if (aretes.length === 1 && Object.hasOwn(est.db.animales, aretes[0])) abrir(aretes[0]); else volver();
    return avisar(`✅ Listo. Se agregaron ${cuantos(n.animales, 'animal nuevo', 'animales nuevos')} y ${cuantos(n.eventos, 'evento nuevo', 'eventos nuevos')}. No se borró nada.${n.descartados ? (n.descartados === 1 ? ' Se ignoró 1 dato dañado que venía mal escrito.' : ` Se ignoraron ${n.descartados} datos dañados que venían mal escritos.`) : ''}`, 7000);
  } catch (e) { ir('lista'); return avisarError(`Este código no es de la app de ganado (${(e as Error).message}).`) }
}

// Partes de un envío en varios códigos: se guardan hasta tenerlas todas (en cualquier orden).
let envio: Envio | null = null, estadoPartes: HTMLElement | null = null;

function leerQr(texto: string, bytes: number[]) {
  const p = leerParte(bytes);
  if (p) {
    const r = sumarParte(envio, p); envio = r.envio;
    if (!r.nueva) return; // el mismo código otra vez: la cámara sigue buscando
    navigator.vibrate?.(80);
    if (faltan(envio).length) { estadoPartes?.replaceChildren(<b>{textoPartes()}</b>); return }
    detenerCamara();
    const trozos = envio.trozos as Uint8Array[]; envio = null;
    return juntarPartes(trozos).then(recibir, e => { enPausa = true; ir('escaner'); avisarError(e instanceof SinSoporte ? e.message + '.' : 'Los códigos QR no se pudieron leer. Intente de nuevo desde el primero.') });
  }
  detenerCamara();
  let l;
  // El aviso va después de ir(): cambiar de pantalla quita los avisos rojos.
  try { l = interpretar(texto) } catch { enPausa = true; ir('escaner'); return avisarError('El código QR no se pudo leer. Intente de nuevo.') }
  if (l.tipo === 'animal') return recibir(l.datos);
  if (!areteValido(l.arete)) { ir('lista'); return avisarError('Este código QR no es de un arete ni de la app de ganado.') }
  if (Object.hasOwn(est.db.animales, l.arete)) return abrir(l.arete);
  // Arete nuevo: se abre el alta ya con el número puesto (si no quiere, toca Volver). Sin ventanita de confirmación.
  est.nuevo = { arete: l.arete.trim() }; abrir(null); est.nuevo = {};
  avisar(`Arete ${l.arete.trim()} no registrado: complete el alta`);
}

const textoPartes = () => !(envio = vigente(envio)) ? '' : `✅ Leídos ${envio.trozos.length - faltan(envio).length} de ${envio.trozos.length} códigos. Falta: ${faltan(envio).join(', ')}. Apunte al siguiente.`;

// Tras un QR que no se pudo leer, la cámara espera a que la persona toque: si se encendiera sola, leería el mismo código sin parar.
let enPausa = false;
export function VerEscaner() {
  const pausa = enPausa; enPausa = false; // vale para este pintado; el siguiente (Intentar de nuevo) enciende la cámara
  return (
    <section>
      <button onClick={() => { envio = null; volver() }}>← Volver</button>
      <h2>Escanear código QR</h2>
      <p role="status" ref={(el: HTMLElement) => (estadoPartes = el)}><b>{textoPartes()}</b></p>
      {pausa ? <button class="grande pri" onClick={render}>📷 Intentar de nuevo</button> : <Escaner alLeer={leerQr} reintentar={render} />}
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
          <QrDeDatos datos={d} />
          <p>En el otro teléfono abra la app, toque <b>“📷 Escanear código QR”</b> y apunte a esta pantalla. Se suma sin borrar nada.</p>
        </> : <p>No hay nada anotado en este teléfono {est.cambiosDias ? 'en esos días' : 'hoy'}.</p>}
      </div>
    </section>
  );
}
