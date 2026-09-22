import { File as ArchivoLocal } from 'expo-file-system';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { prepararStructuredCloneParaPdf } from './structuredClonePdf';

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PAGINAS = 40;

export async function extraerTextoPdf(archivo: DocumentPickerAsset): Promise<{ texto: string; paginas: number }> {
  if (archivo.size && archivo.size > MAX_BYTES) throw new Error('El PDF supera el límite de 20 MB. Divide el estado de cuenta e inténtalo de nuevo.');

  const bytes = archivo.file
    ? new Uint8Array(await archivo.file.arrayBuffer())
    : await new ArchivoLocal(archivo.uri).bytes();

  if (bytes.byteLength > MAX_BYTES) throw new Error('El PDF supera el límite de 20 MB. Divide el estado de cuenta e inténtalo de nuevo.');
  if (bytes.byteLength < 5 || String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') {
    throw new Error('El archivo elegido no parece ser un PDF válido.');
  }

  // Carga diferida: la app no paga el costo del lector hasta abrir esta pantalla.
  // La compatibilidad debe instalarse antes de evaluar PDF.js.
  prepararStructuredCloneParaPdf();
  const { extractTextItems, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(bytes, { maxImageSize: 16_777_216 });
  try {
    if (pdf.numPages > MAX_PAGINAS) throw new Error(`El PDF tiene ${pdf.numPages} páginas; el máximo por importación es ${MAX_PAGINAS}.`);
    const limite = new Promise<never>((_, rechazar) => {
      setTimeout(() => rechazar(new Error('La lectura tardó demasiado. Prueba con un PDF más pequeño.')), 25_000);
    });
    const resultado = await Promise.race([extractTextItems(pdf), limite]);
    // Reconstruye cada renglón por sus coordenadas. Es más fiable para las tablas
    // de los bancos que concatenar el texto en el orden interno del PDF.
    const texto = resultado.items.map((pagina) => {
      const renglones = new Map<number, typeof pagina>();
      for (const item of pagina) {
        const linea = Math.round(item.y / 2);
        renglones.set(linea, [...(renglones.get(linea) ?? []), item]);
      }
      return [...renglones.entries()]
        .sort(([yA], [yB]) => yB - yA)
        .map(([, items]) => items.sort((a, b) => a.x - b.x).map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');
    }).join('\n');
    return { texto, paginas: resultado.totalPages };
  } finally {
    await (pdf as unknown as { destroy(): Promise<void> }).destroy();
  }
}
