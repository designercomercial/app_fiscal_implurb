import type { Metadata } from "next";
import { Suspense } from "react";
import { ConsultaLicencaApp } from "@/components/licenca/ConsultaLicencaApp";

export const metadata: Metadata = { title: "Consultar licença de obra · Libera Fácil" };

/** Página aberta pelo canal URL "Consultar Licença de Obra" do App do Fiscal (SASI). */
export default function ConsultarLicencaPage() {
  return (
    <Suspense>
      <ConsultaLicencaApp />
    </Suspense>
  );
}
