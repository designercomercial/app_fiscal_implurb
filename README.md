# Libera Fácil: páginas do App do Fiscal

Páginas que os canais URL do App do Fiscal (SASI) abrem em webview:

| Canal | Página | O que faz |
|---|---|---|
| Ações do Dia | `/fiscal/acoes-do-dia` | Ações de fiscalização do dia do fiscal logado, em ordem de prioridade. Nela o fiscal registra "Estou a caminho", "Iniciar vistoria" e "Não consegui realizar". |
| Consultar Licença de Obra | `/fiscal/consultar-licenca` | Busca por alvará, processo ou endereço. Mostra a situação da licença e o que foi aprovado. |

Stack: Next.js 15 (App Router), TypeScript, Tailwind CSS 4 sobre os tokens do SASI Design System, Lucide, Vitest com Testing Library e Playwright.

## Como rodar

```bash
npm install
npm run dev            # http://localhost:3000/fiscal/acoes-do-dia
```

| Comando | O que faz |
|---|---|
| `npm test` | Testes unitários, de componente e de back-end (Vitest) |
| `npm run test:e2e` | Testes de tela (Playwright). Gera um build de produção em `.next-e2e` e sobe na porta 3100. Na primeira vez, rode `npx playwright install chromium`. |
| `npm run typecheck` | Checagem de tipos |
| `npm run build && npm start` | Build e servidor de produção |

### Parâmetros úteis na URL (somente mock)
- `?fiscal=f-002`: entra como outra fiscal (Ana Ribeiro), para ver o isolamento.
- `?tema=dark` ou `?tema=light`: força o tema. Sem o parâmetro, a página segue o aparelho.

### Simular o recebimento do formulário (desenvolvimento)
A ação só vira **concluída** quando o Libera Fácil recebe o formulário do app. Para simular:

```bash
curl -X POST localhost:3000/api/dev/formulario-recebido \
  -H "content-type: application/json" -d '{"codigo_acao":"ACAO-2026-001245"}'
curl -X POST localhost:3000/api/dev/reiniciar   # volta os dados mock ao início
```

Os dois endpoints `/api/dev/*` ficam desligados em produção.

## Onde trocar

| O quê | Arquivo | Como |
|---|---|---|
| **Autenticação** (mock) | [src/server/auth.ts](src/server/auth.ts) | Troque `autenticarMock` por validação de token, sessão ou SSO. Todo o resto usa só `getFiscalAtual(request)`. Fiscal inválido: retorne `null` (vira 401). |
| **Link do formulário SASI** | [src/domain/formulario-sasi.ts](src/domain/formulario-sasi.ts) | Defina `NEXT_PUBLIC_SASI_FORM_LINK_TEMPLATE` (ex.: `sasi://canal/{canal_id}?codigo_acao={codigo}`; aceita `{canal_id}`, `{canal}` e `{codigo}`) ou edite `montarLinkFormulario`. Sem template, a página copia o código e mostra "Código copiado. Abra o canal … e cole no primeiro campo." Os `id` dos canais em `CANAL_POR_TIPO` são provisórios. |
| **Banco de dados** | [src/server/acoes-repo.ts](src/server/acoes-repo.ts) | Implemente a interface `AcoesRepositorio`. Hoje os dados ficam em memória e são recriados a cada dia. |
| **Reagendar ação não realizada** | [src/server/fila.ts](src/server/fila.ts) | `reagendarParaDiaSeguinte` é chamado depois de gravar `nao_realizada`. Implemente aqui a fila do dia seguinte. |
| **Intervalo de atualização** | [src/client/use-acoes-do-dia.ts](src/client/use-acoes-do-dia.ts) | `INTERVALO_ATUALIZACAO_MS` (5 min, só com a página visível) |

## API

`GET /api/fiscal/acoes-do-dia?data=AAAA-MM-DD`: ações do fiscal logado e resumo. Sem `data`, usa hoje no fuso de Manaus.

`POST /api/fiscal/acoes/{codigo}/status`: corpo `{ status, motivo_nao_realizada?, motivo_outro?, status_anterior? }`

| Resposta | Quando |
|---|---|
| 200 `{ acao }` | Transição válida |
| 400 | Corpo inválido, motivo ausente ou inválido, "outro" sem texto (máx. 500 caracteres) |
| 401 | Sem fiscal autenticado |
| 404 | Ação inexistente **ou de outro fiscal**. Não revela que a ação existe. |
| 409 | Transição inválida, tentativa de concluir pela página, ou `status_anterior` diferente do atual (alguém mudou antes). A resposta traz a ação atual. |

Regras ([src/domain/status.ts](src/domain/status.ts)): pendente → em_deslocamento → em_execucao. Os três status em aberto podem ir para nao_realizada, com motivo. em_execucao → concluida **só** pela integração (`concluirPorFormulario`). Toda mudança grava a trilha de auditoria: de, para, motivo, usuário, origem, data e hora.

## Consultar licença de obra

Um campo só, que reconhece o formato do que foi digitado ([src/domain/licenca.ts](src/domain/licenca.ts)):

| O fiscal digita | O sistema busca por |
|---|---|
| Começa com `ALV` | Número do alvará (aceita parte do número) |
| `AAAA.NNN.NNNN`, com ou sem pontos | Número do processo |
| Qualquer outro texto, a partir de 3 caracteres | Endereço ou bairro, sem diferenciar acentos (todas as palavras precisam aparecer) |

- **Número exato:** abre direto o detalhe. O detalhe também abre por `?licenca=ALV-…`, usado pelo link "Consultar licença" no detalhe de uma ação que tem alvará.
- **Situação:** é calculada a partir do status do cadastro e da validade:
  - Válida;
  - Vence em breve (30 dias ou menos);
  - Vencida;
  - Suspensa;
  - Cancelada;
  - Em análise.

  Cada situação aparece sempre com ícone e texto.
- **Proteção de dados (LGPD):** o CPF/CNPJ do proprietário sai do servidor mascarado (`***.456.789-**`) e não pode ser usado como termo de busca.
- **Auditoria:** cada busca e cada detalhe aberto registram quem consultou, o quê e quando.
- **Sem internet:** as últimas 15 licenças consultadas ficam no aparelho. Sem rede, a busca procura nelas e o detalhe avisa o horário dos dados.

API:
- `GET /api/fiscal/licencas?q=termo`:
  - 200 com no máximo 20 resultados e `truncado` quando há mais;
  - 400 para busca curta;
  - 401 sem fiscal autenticado.
- `GET /api/fiscal/licencas/{alvará ou processo}`: 200, 404 ou 401.

Repositório (mock em memória): `LicencasRepositorio`, em [src/server/licencas-service.ts](src/server/licencas-service.ts). Dados mock: [src/server/licencas-mock.ts](src/server/licencas-mock.ts) tem 10 licenças. Vários alvarás coincidem com as ações mock.

## Decisões de implementação
- **Isolamento:** o filtro por fiscal é feito no serviço do back-end ([src/server/acoes-service.ts](src/server/acoes-service.ts)). A página nunca recebe `fiscal_id`.
- **Sem internet:**
  - a última lista fica no `localStorage`, com o horário em que foi recebida;
  - um service worker mínimo ([public/sw.js](public/sw.js), só em produção) permite reabrir a página sem rede;
  - mudanças de status ficam bloqueadas sem rede, para não criar registros que o servidor não recebeu.
- **Erro de conexão × sem internet:** "Você está sem internet" só aparece quando o aparelho está offline. Servidor fora do ar mostra "Não foi possível atualizar/carregar" com "Tentar novamente".
- **Ordenação "Prioridade":** ações em andamento ficam no topo. Depois vêm a prioridade, as atrasadas e as que vencem hoje, o prazo e a ordem da rota.
- **Design:**
  - tokens oficiais copiados em [src/styles/sasi-tokens.css](src/styles/sasi-tokens.css);
  - o Tailwind só enxerga os tokens semânticos (a paleta padrão está desligada em [app/globals.css](app/globals.css));
  - dois ajustes, feitos só de token para token:
    - a raiz volta a 16 px (a base SASI usa 14 px);
    - o texto de aviso e de sucesso no tema claro e o texto de marca no escuro usam um passo mais forte da mesma escala, para atingir contraste AA.

## Pendente de definição
1. **Autenticação:** token na URL enviado pelo SASI, sessão do Libera Fácil ou SSO.
2. **Formato do link** que abre o canal do SASI com o código pré-preenchido, e os ids reais dos canais.
3. **Integração do formulário:** como o Libera Fácil recebe o formulário do app (webhook, fila ou consulta) e com que credencial.
4. **"Ação do dia":** o modelo não tem campo de data programada. O mock usa um campo interno `data_programada`. Falta definir se a lista do dia vem por esse campo, pelo prazo ou pela distribuição da chefia.
5. **Reagendamento de não realizadas:** como entra na fila de D+1 (nova ação ou mesma ação reprogramada) e se mantém prioridade e ordem de rota.
6. **Zona de atuação** do fiscal: de onde vem o dado.
7. **Mudança de status sem internet:** hoje é bloqueada. Falta decidir se deve virar uma fila offline com envio posterior.
8. **Tema:** se o App do Fiscal vai informar o tema (claro ou escuro) pela URL.
9. **Fonte Circular Std** (display SASI): os arquivos não estão no repositório. O título usa a fonte de fallback do token (Geist).
10. **Licenças, fonte dos dados:** qual sistema guarda o cadastro de alvarás e qual é o formato oficial do número (o mock usa `ALV-AAAA-NNNNN`).
11. **Licenças, prazo de alerta:** "vence em breve" usa 30 dias. Falta confirmar com a chefia.
12. **Licenças, QR Code da placa da obra:** não está nesta versão. Se a placa tiver QR, a busca pode abrir a câmera.
13. **Licenças, regra de visibilidade:** hoje qualquer fiscal autenticado consulta qualquer licença. Falta confirmar se deve haver restrição por zona.
