import type { Metadata } from "next";
import { ValidarDocumentoApp } from "@/components/cidadao/ValidarDocumentoApp";

export const metadata: Metadata = { title: "Validar alvará · Libera Fácil" };

/**
 * Canal URL "Validar Alvará" do App do Cidadão (SASI). Pública.
 * O QR Code impresso nos documentos aponta para /validar?codigo=XXXX.
 */
export default function ValidarPage() {
  return <ValidarDocumentoApp />;
}
