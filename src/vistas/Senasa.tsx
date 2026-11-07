// Antes de agregar el Excel de SENASA: a qué finca de la app va cada finca del Excel y si sus animales son de leche o de carne.
// Después de agregar, la misma pantalla muestra qué se hizo (sin ventanitas del navegador, que algunas apps bloquean).
import { h, Fragment } from '../jsx';
import { cuantos, fincas } from '../datos';
import { MAX_NUEVOS, Motivo, Omitida, agregarSenasa, planSenasa } from '../senasa';
import { avisarError, est, quitarError, guardarYAvisar, render, volver } from '../estado';

// Qué pasa con una entrega que no se agrega, y qué puede hacer la persona.
function textoOmitida(o: Omitida) {
  const ya = o.yaEstan >= o.total ? 'Ya están todos en la app.' : o.yaEstan ? `De ese rango ya hay ${o.yaEstan} en la app.` : '';
  const que: Record<Motivo, string> = {
    'sin-lista': `${cuantos(o.total, 'arete', 'aretes')} sin lista: el Excel solo dice el primero y el último, así que no se agregan.`,
    'demasiados': `${cuantos(o.total, 'arete', 'aretes')} en una sola entrega: son demasiados para ser de una finca, no se agregan.`,
    'sin-cero': `${cuantos(o.total, 'arete tiene', 'aretes tienen')} ${o.digitos} números y los suyos tienen ${o.normal}: Excel pudo quitarles un 0 al inicio, así que no se agregan.`,
    'largo-raro': `${cuantos(o.total, 'arete tiene', 'aretes tienen')} ${o.digitos} números y los suyos tienen ${o.normal}: puede ser un error del Excel, no se agregan.`,
  };
  const hacer = o.yaEstan >= o.total ? '' : o.motivo === 'sin-cero' || o.motivo === 'largo-raro' ? 'Pida el Excel otra vez a SENASA o agréguelos uno por uno.' : 'Si le faltan, agréguelos uno por uno con su arete.';
  return [que[o.motivo], ya, hacer].filter(Boolean).join(' ');
}

function Resumen() {
  const r = est.senasa!.resultado!;
  return (
    <section>
      <h2 tabindex="-1" id="s-resumen">✅ Excel de SENASA agregado</h2>
      <div class="card">
        <p><b>{r.nuevos ? `Se agregaron ${cuantos(r.nuevos, 'animal nuevo', 'animales nuevos')}.` : 'No había aretes nuevos para agregar.'}</b></p>
        {r.fincasLlenadas > 0 && <p>{r.fincasLlenadas === 1 ? 'Al animal que no tenía finca' : `A los ${r.fincasLlenadas} animales que no tenían finca`} se le{r.fincasLlenadas === 1 ? '' : 's'} puso la finca del Excel.</p>}
        {r.omitidas.map(o => <p class="warn">⚠️ {o.finca}: {textoOmitida(o)}</p>)}
        <p class="mut">No se borró nada. Los animales nuevos llevan una nota para completar sexo, raza y nacimiento.</p>
      </div>
      <button class="pri grande" onClick={() => { est.senasa = null; volver() }}>← Volver a mis animales</button>
    </section>
  );
}

export function Senasa() {
  const p = est.senasa;
  if (!p) return <section><button onClick={volver}>← Volver</button><p>No hay un Excel de SENASA para agregar.</p></section>;
  if (p.resultado) return <Resumen />;
  const enExcel = [...new Set(p.rangos.map(r => r.finca))], suyas = fincas(est.db);
  const plan = planSenasa(est.db, p.rangos), demasiados = plan.nuevos > MAX_NUEVOS, hayAlgo = plan.nuevos + plan.sinFinca > 0;
  const omitidasDe = (f: string) => plan.omitidas.filter(o => o.finca === f);
  // Una finca cuyas entregas no se agregan no necesita elegir finca ni leche o carne.
  // Solo pide finca y tipo donde hay algo que agregar (al reimportar, una finca con todo ya en la app no muestra campos).
  const seAgrega = (f: string) => (plan.porFinca[f] ?? 0) > 0;
  const agregar = () => {
    const sinNombre = enExcel.findIndex(f => seAgrega(f) && !p.destinos[f].nombre);
    if (sinNombre >= 0) {
      // El error va debajo de su campo (no flota) y el foco se queda en el campo vacío.
      document.getElementById('s-finca-error-' + sinNombre)!.textContent = 'Escriba a qué finca van estos aretes.';
      return document.getElementById('s-finca-' + sinNombre)?.focus();
    }
    // Si el teléfono no puede guardar (sin espacio), se vuelve a como estaba: nada queda solo en memoria.
    const antes = JSON.stringify(est.db), r = agregarSenasa(est.db, p.rangos, p.destinos);
    if (!guardarYAvisar()) {
      est.db = JSON.parse(antes); quitarError('otros'); est.senasa = null; volver(); // el aviso de guardado se queda
      return avisarError('No se pudo guardar: el teléfono no tiene espacio. No se agregó nada; todo quedó como estaba.');
    }
    p.resultado = r; render(); scrollTo(0, 0);
    document.getElementById('s-resumen')?.focus(); // el foco va al resumen, no se pierde en la página
  };
  return (
    <section>
      <button onClick={() => { est.senasa = null; volver() }}>← Volver sin agregar</button>
      <h2>📄 Excel de SENASA</h2>
      <p>Trae {cuantos(p.rangos.length, 'entrega', 'entregas')} de aretes en {cuantos(enExcel.length, 'finca', 'fincas')}. Solo se agregan los que falten; no se borra nada.</p>
      <p class="ayuda">Revise a qué finca va cada una y si sus animales son de leche o de carne.</p>
      <datalist id="s-fincas">{suyas.map(f => <option value={f} />)}</datalist>
      {enExcel.map((f, i) => {
        const d = p.destinos[f];
        let etiqueta!: HTMLElement;
        const marcar = () => { etiqueta.textContent = !d.nombre ? '' : suyas.includes(d.nombre) ? '✓ Ya existe en la app' : '✚ Finca nueva: se va a crear' };
        return (
          <div class="card">
            <p class="mut">En el Excel: <b>{f}</b></p>
            {omitidasDe(f).map(o => <p class="warn">⚠️ {textoOmitida(o)}</p>)}
            {seAgrega(f) && <>
              <label for={'s-finca-' + i}>Finca en la app</label>
              <input id={'s-finca-' + i} list="s-fincas" maxlength="80" value={d.nombre} aria-describedby={'s-finca-error-' + i}
                onInput={(e: Event) => { d.nombre = (e.target as HTMLInputElement).value.trim(); marcar(); document.getElementById('s-finca-error-' + i)!.textContent = '' }} />
              <p class="error-campo" id={'s-finca-error-' + i} role="alert"></p>
              <p class="ayuda" ref={(el: HTMLElement) => { etiqueta = el; marcar() }}></p>
              <div class="eventos">
                {(['leche', 'carne'] as const).map(t => (
                  <button aria-pressed={String(d.tipo === t)} onClick={(e: Event) => {
                    d.tipo = t;
                    for (const b of (e.currentTarget as HTMLElement).parentElement!.children) b.setAttribute('aria-pressed', String(b === e.currentTarget));
                  }}>{t === 'leche' ? '🥛 Leche' : '🥩 Carne'}</button>
                ))}
              </div>
            </>}
          </div>
        );
      })}
      {demasiados
        ? <p class="card warn">⚠️ Este Excel crearía más de {MAX_NUEVOS} animales de una vez: es demasiado. Revise que sea el Excel de aretes de SENASA.</p>
        : hayAlgo
          ? <button class="pri grande" onClick={agregar}>➕ Agregar {plan.nuevos ? cuantos(plan.nuevos, 'arete que falta', 'aretes que faltan') : 'la finca a los que no la tienen'}</button>
          : <p class="card">✅ Todos los aretes de este Excel ya están en la app. No hay nada que agregar.</p>}
    </section>
  );
}
