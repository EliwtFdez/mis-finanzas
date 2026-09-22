let preparado = false;

/**
 * PDF.js pasa `null` como segundo argumento cuando no transfiere buffers.
 * Hermes usa el polyfill de @ungap, que intenta desestructurar ese null y falla.
 * Esta capa conserva structuredClone y normaliza únicamente ese argumento.
 */
export function prepararStructuredCloneParaPdf() {
  if (preparado || typeof globalThis.structuredClone !== 'function') return;
  const clonar = globalThis.structuredClone.bind(globalThis);
  globalThis.structuredClone = ((valor: unknown, opciones?: StructuredSerializeOptions | null) =>
    clonar(valor, opciones ?? undefined)) as typeof globalThis.structuredClone;
  preparado = true;
}
