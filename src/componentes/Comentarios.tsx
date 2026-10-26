import { h } from '../jsx';
import { CORREO_COMENTARIOS, REPOSITORIO } from '../config';

// Solo se envía lo que la persona escribe: nunca datos del ganado.
export function Comentarios() {
  let texto!: HTMLTextAreaElement;
  const asunto = 'Comentario sobre Registro de Ganado';
  const leer = () => {
    const t = texto.value.trim();
    if (!t) { alert('Primero escriba su comentario en el cuadro.'); texto.focus() }
    return t;
  };
  const porCorreo = () => {
    const t = leer(); if (!t) return;
    location.href = `mailto:${CORREO_COMENTARIOS}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(t)}`;
  };
  const enRepositorio = () => {
    const t = leer(); if (!t) return;
    open(`${REPOSITORIO}/issues/new?title=${encodeURIComponent(asunto)}&body=${encodeURIComponent(t)}`, '_blank', 'noopener');
  };
  return (
    <details>
      <summary>💬 Enviar comentarios o ideas</summary>
      <p class="ayuda">Esta app es gratuita y de código abierto. Si algo no se entiende, falla o se le ocurre una mejora, cuéntenos.</p>
      <label for="f-comentario">¿Qué nos quiere decir?</label>
      <textarea id="f-comentario" rows="4" ref={(el: HTMLTextAreaElement) => (texto = el)} placeholder="Ej.: no encuentro cómo anotar un parto"></textarea>
      {CORREO_COMENTARIOS && <button class="pri grande" onClick={porCorreo}>✉️ Enviar por correo</button>}
      <button class={CORREO_COMENTARIOS ? 'grande' : 'pri grande'} onClick={enRepositorio}>🛠️ Reportar en el repositorio del proyecto</button>
      <p class="ayuda">{CORREO_COMENTARIOS ? 'El repositorio es para personas con cuenta técnica; para todo lo demás use el correo.' : 'Necesita una cuenta en el sitio del repositorio.'}</p>
    </details>
  );
}
