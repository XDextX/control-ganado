import { h } from '../jsx';
import { Animal, CAMPOS, CATEGORIAS, areteValido, EVENTOS, MOTIVOS, TipoEvento, fincas, fmt, guardar, hoy, kilos, nuevoId, ordenados, prenezAbierta, retiro, textoEvento, totalPesaje, trasladar, ultimoPesaje } from '../datos';
import { abrir, avisar, est, ir, mostrarReporte, render, volver } from '../estado';
import { EliminarAnimal } from '../componentes/EliminarDatos';
import { NombreYArete } from '../componentes/Arete';

function Formulario({ a }: { a: Animal | null }) {
  const guardarAnimal = (e: Event) => {
    e.preventDefault();
    const { db } = est, f = e.target as HTMLFormElement, val = (k: string) => (f.elements.namedItem(k) as HTMLInputElement).value.trim();
    const arete = val('arete');
    if (!areteValido(arete)) return alert('Ese número de arete no es válido. Use hasta 40 letras o números.');
    if (arete !== a?.arete && db.animales[arete]) return alert('Ya existe un animal con el arete ' + arete);
    const nuevo = a ?? ({ eventos: [] } as unknown as Animal);
    if (a && arete !== a.arete) delete db.animales[a.arete];
    for (const k of CAMPOS) (nuevo as any)[k] = val(k);
    nuevo.creado ??= hoy();
    db.animales[arete] = nuevo; guardar(db); abrir(arete); avisar('✅ Animal guardado');
  };
  return (
    <form class="card" onSubmit={guardarAnimal}>
      <h2>{a ? 'Cambiar datos del animal ' + a.arete : 'Agregar un animal'}</h2>
      <label for="f-arete">Número de arete (obligatorio)</label>
      <input id="f-arete" name="arete" required inputmode="numeric" value={a?.arete ?? est.nuevo.arete ?? ''} />
      <label for="f-nombre">Nombre (si tiene)</label>
      <input id="f-nombre" name="nombre" value={a?.nombre ?? est.nuevo.nombre ?? ''} />
      <label for="f-finca">Finca</label>
      <input id="f-finca" name="finca" list="listaFincas" value={a?.finca ?? est.nuevo.finca ?? ''} />
      <datalist id="listaFincas">{fincas(est.db).map(f => <option value={f} />)}</datalist>
      <details open={!a && !!est.nuevo.nac}>
        <summary>Más datos (opcional)</summary>
        <label for="f-tipo">Tipo</label>
        <select id="f-tipo" name="tipo" value={a?.tipo ?? est.nuevo.tipo ?? 'leche'}><option value="leche">Leche</option><option value="carne">Carne</option></select>
        <label for="f-nac">Fecha de nacimiento</label>
        <input id="f-nac" name="nac" type="date" value={a?.nac ?? est.nuevo.nac ?? ''} />
        <p class="ayuda">Toque el cuadro para elegir la fecha.</p>
        <label for="f-sexo">Sexo</label>
        <select id="f-sexo" name="sexo" value={a?.sexo || 'H'}><option value="H">Hembra</option><option value="M">Macho</option></select>
        <label for="f-raza">Raza</label>
        <input id="f-raza" name="raza" value={a?.raza ?? est.nuevo.raza ?? ''} />
        <label for="f-cat">Categoría</label>
        <select id="f-cat" name="categoria" value={a?.categoria ?? ''}><option value="">—</option>{CATEGORIAS.map(c => <option>{c}</option>)}</select>
        <label for="f-notas">Notas</label>
        <textarea id="f-notas" name="notas" rows="2" value={a?.notas ?? est.nuevo.notas ?? ''}></textarea>
      </details>
      <button class="pri grande">💾 Guardar animal</button>
    </form>
  );
}

// Los más comunes como botones grandes; el resto en "Otro".
const COMUNES: [TipoEvento, string][] = [['monta', '🐂 Monta'], ['parto', '🍼 Parto'], ['secado', '🥛 Secado'], ['celo', '🔥 Celo']];

// Lo menos frecuente, también con botones. Vender, morir o dar de baja son una "salida" (retiro) con su motivo.
const OTROS: [TipoEvento, string, string?][] = [
  ['prenez', '✔️ Preñez confirmada'], ['destete', '🐄 Destete'], ['aborto', '❌ Aborto / vacía'],
  ['retiro', '💰 Vendido', MOTIVOS[0]], ['retiro', '✝️ Murió', MOTIVOS[1]], ['retiro', '📤 Dado de baja', MOTIVOS[2]],
  ['traslado', '🚚 Pasó a otra finca'],
];

function NuevoEvento({ a }: { a: Animal }) {
  let tipo!: HTMLInputElement, motivo!: HTMLInputElement, otroBox!: HTMLElement, form!: HTMLElement, destinoBox!: HTMLElement, guardarBtn!: HTMLElement;
  const elegir = (t: string, m: string, boton: HTMLElement) => {
    tipo.value = t; motivo.value = m;
    for (const b of form.querySelectorAll('.eventos button')) b.setAttribute('aria-pressed', String(b === boton));
    destinoBox.classList.toggle('hide', t !== 'traslado');
    // Una salida saca al animal de la lista: el botón lo dice claro (en lugar de una ventanita de confirmación).
    guardarBtn.textContent = t === 'retiro' ? `💾 Guardar: ${m} (ya no saldrá en la lista)` : '💾 Guardar lo que pasó';
    guardarBtn.classList.toggle('peligro', t === 'retiro');
  };
  const enviar = (e: Event) => {
    e.preventDefault();
    const f = e.target as HTMLFormElement, val = (k: string) => (f.elements.namedItem(k) as HTMLInputElement).value.trim();
    if (!tipo.value) return alert('Primero toque qué pasó: Monta, Parto, Secado, Celo u Otro.');
    if (tipo.value === 'traslado') {
      const hacia = val('destino');
      if (!hacia) return alert('Escriba o elija la finca a la que pasó.');
      if (hacia === a.finca) return alert(`El animal ya está en ${hacia}.`);
      trasladar(a, hacia, val('fecha'), val('nota')); guardar(est.db); render(); return avisar('✅ Pasó a ' + hacia);
    }
    const ev = { id: nuevoId(), tipo: tipo.value as TipoEvento, fecha: val('fecha'), nota: val('nota'), motivo: undefined as string | undefined };
    if (ev.tipo === 'retiro') ev.motivo = motivo.value;
    else delete ev.motivo;
    if (ev.tipo === 'parto') est.criaDe = a.arete;
    a.eventos.push(ev); guardar(est.db); render(); avisar('✅ Guardado: ' + (ev.motivo ?? EVENTOS[ev.tipo]));
  };
  return (
    <form class="card" onSubmit={enviar} ref={(el: HTMLElement) => (form = el)}>
      <h2>¿Qué pasó con este animal?</h2>
      <input type="hidden" ref={(el: HTMLInputElement) => (tipo = el)} />
      <input type="hidden" ref={(el: HTMLInputElement) => (motivo = el)} />
      <div class="eventos">
        {COMUNES.map(([t, texto]) => <button type="button" aria-pressed="false"
          onClick={(e: Event) => { otroBox.classList.add('hide'); elegir(t, '', e.currentTarget as HTMLElement) }}>{texto}</button>)}
        <button type="button" aria-pressed="false" style="grid-column:1/-1"
          onClick={(e: Event) => { otroBox.classList.remove('hide'); elegir('', '', e.currentTarget as HTMLElement) }}>➕ Otro (preñez, destete, venta, muerte, traslado…)</button>
      </div>
      <div class="hide eventos" ref={(el: HTMLElement) => (otroBox = el)}>
        {OTROS.map(([t, texto, m]) => <button type="button" aria-pressed="false"
          onClick={(e: Event) => elegir(t, m ?? '', e.currentTarget as HTMLElement)}>{texto}</button>)}
      </div>
      <div class="hide" ref={(el: HTMLElement) => (destinoBox = el)}>
        <label for="f-destino">¿A qué finca pasó? (ahora está en {a.finca || 'ninguna'})</label>
        <input id="f-destino" name="destino" list="listaDestinos" />
        <datalist id="listaDestinos">{fincas(est.db).filter(f => f !== a.finca).map(f => <option value={f} />)}</datalist>
      </div>
      <label for="f-fecha">Fecha</label>
      <input id="f-fecha" name="fecha" type="date" required value={hoy()} />
      <p class="ayuda">Ya tiene la fecha de hoy. Toque el cuadro si fue otro día.</p>
      <label for="f-nota">Nota (si quiere)</label>
      <input id="f-nota" name="nota" placeholder="Ej.: toro Pinto, cría macho" />
      <button class="pri grande" ref={(el: HTMLElement) => (guardarBtn = el)}>💾 Guardar lo que pasó</button>
    </form>
  );
}

// Borrar pide un segundo toque en el mismo botón (no una ventanita del navegador, que algunas apps bloquean).
function borrarEvento(a: Animal, id: string, boton: HTMLButtonElement) {
  if (boton.dataset.seguro !== '1') {
    boton.dataset.seguro = '1'; boton.textContent = '¿Seguro? Toque otra vez';
    setTimeout(() => { boton.dataset.seguro = ''; boton.textContent = 'Borrar' }, 4000);
    return;
  }
  a.eventos = a.eventos.filter(x => x.id !== id); guardar(est.db); render(); avisar('✅ Borrado');
}

// Últimos pesajes de la vaca, con flecha de si subió o bajó respecto al anterior.
function Pesajes({ a }: { a: Animal }) {
  const todos = ordenados(a).filter(e => e.tipo === 'pesaje');
  if (!todos.length) return null;
  const ultimos = todos.slice(-5).reverse();
  return (
    <div class="card"><h2>🥛 Pesajes de leche</h2>
      <ul>
        {ultimos.map(e => {
          const ant = todos[todos.indexOf(e) - 1], dif = ant ? totalPesaje(e) - totalPesaje(ant) : 0;
          return (
            <li class="ev">
              <span><b>{kilos(totalPesaje(e))}</b> {dif > 0 ? <span class="ok">▲ {kilos(dif)}</span> : dif < 0 ? <span class="bad">▼ {kilos(-dif)}</span> : null}<br />
                <span class="mut">{fmt(e.fecha)} · ☀️ {kilos(e.am ?? 0)} · 🌙 {kilos(e.pm ?? 0)}</span></span>
              <button class="borrar" onClick={(ev: Event) => borrarEvento(a, e.id, ev.currentTarget as HTMLButtonElement)}>Borrar</button>
            </li>
          );
        })}
      </ul>
      {todos.length > 5 && <p class="ayuda">Mostrando los últimos 5 de {todos.length}. Todos están en el reporte “🥛 Pesajes de leche”.</p>}
    </div>
  );
}

function Historial({ a }: { a: Animal }) {
  const c = (t: TipoEvento) => a.eventos.filter(e => e.tipo === t).length;
  const eventos = ordenados(a).filter(e => e.tipo !== 'pesaje').reverse(); // los pesajes tienen su propio cuadro
  return (
    <div class="card"><h2>Historial</h2>
      <div class="mut">
        Preñeces: {c('prenez')} · Partos: {c('parto')} · Celos: {c('celo')} · Destetes: {c('destete')} · Secados: {c('secado')}
      </div>
      <ul>
        {eventos.length ? eventos.map(e => (
          <li class="ev">
            <span><b>{textoEvento(e)}</b><br />
              <span class="mut">{fmt(e.fecha)}{e.nota ? ' · ' + e.nota : ''}</span></span>
            <button class="borrar" onClick={(ev: Event) => borrarEvento(a, e.id, ev.currentTarget as HTMLButtonElement)}>Borrar</button>
          </li>
        )) : <li class="mut">Sin eventos todavía.</li>}
      </ul>
    </div>
  );
}

// Alta de la cría con lo que ya se sabe de la madre y del parto.
function agregarCria(madre: Animal) {
  const parto = ordenados(madre).reverse().find(e => e.tipo === 'parto');
  est.nuevo = { finca: madre.finca, tipo: madre.tipo, raza: madre.raza, nac: parto?.fecha ?? hoy(),
    notas: `Cría de ${madre.arete}${madre.nombre ? ' (' + madre.nombre + ')' : ''}` };
  abrir(null); est.nuevo = {};
}


export function Ficha() {
  const a = est.actual;
  if (!a) return <section><button onClick={volver}>← Volver</button><Formulario a={null} /></section>;
  // Animal existente: primero lo de todos los días; datos y QR guardados abajo para no cambiarlos sin querer.
  const p = prenezAbierta(a), r = retiro(a);
  return (
    <section>
      <button onClick={volver}>← Volver</button>
      <div class="card">
        <h2 class="titulo-animal">🐄 <NombreYArete nombre={a.nombre} arete={a.arete} /></h2>
        <p class="mut">{[a.finca, a.categoria, a.raza, a.tipo === 'leche' ? 'Leche' : 'Carne'].filter(Boolean).join(' · ')}</p>
        {r ? <p class="bad"><b>Salió: {r.motivo} el {fmt(r.fecha)}</b></p>
          : p ? <p class="warn"><b>Preñada · parto probable {fmt(p.parto)}{p.secado ? ' · secar el ' + fmt(p.secado) : ''}</b></p> : null}
        {ultimoPesaje(a) && <p>🥛 Último pesaje: <b>{kilos(totalPesaje(ultimoPesaje(a)!))}</b> el {fmt(ultimoPesaje(a)!.fecha)}</p>}
      </div>
      {est.criaDe === a.arete && <div class="card">
        <h2>🍼 ¿Nació una cría?</h2>
        <p>Puede agregarla ahora. La finca y la fecha de nacimiento ya van puestas; solo falta su número de arete.</p>
        <button class="pri grande" onClick={() => agregarCria(a)}>➕ Agregar la cría</button>
      </div>}
      {!r && <NuevoEvento a={a} />}
      <Pesajes a={a} />
      <Historial a={a} />
      <details>
        <summary>✏️ Cambiar datos del animal</summary>
        <Formulario a={a} />
      </details>
      <details>
        <summary>📲 Compartir o imprimir</summary>
        <button class="grande" onClick={() => mostrarReporte('ficha')}>📋 Reporte de este animal</button>
        <button class="grande" onClick={() => { est.qrModo = 'animal'; ir('qr') }}>📲 Pasar este animal a otro teléfono (QR)</button>
        <button class="grande" onClick={() => { est.qrModo = 'corral'; ir('qr') }}>🏷️ Código QR para el arete o corral</button>
      </details>
      <EliminarAnimal a={a} />
    </section>
  );
}
