/**
 * PDF de DEMONSTRAÇÃO do documento emitido (uma página, só texto).
 *
 * >>> PONTO DE TROCA <<<
 * No sistema real, o PDF oficial vem do Libera Fácil (com brasão, QR Code e assinatura).
 * Troque a rota /api/cidadao/documentos/[numero]/pdf para devolver esse arquivo.
 */

function escapar(texto: string): string {
  return texto.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Gera um PDF simples com linhas de texto (Helvetica, acentos via WinAnsi). */
export function gerarPdfTexto(linhas: { texto: string; tamanho?: number; espaco?: number }[]): Uint8Array {
  let y = 790;
  const comandos: string[] = ["BT"];
  for (const l of linhas) {
    const tamanho = l.tamanho ?? 11;
    y -= l.espaco ?? tamanho * 1.6;
    comandos.push(`/F1 ${tamanho} Tf 1 0 0 1 56 ${y.toFixed(0)} Tm (${escapar(l.texto)}) Tj`);
  }
  comandos.push("ET");
  const conteudo = comandos.join("\n");

  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(conteudo, "latin1")} >>\nstream\n${conteudo}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objetos.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}
