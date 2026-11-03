# RPC, limites e orçamento

Endpoint padrão da Beta: `https://api.devnet.solana.com`. Genesis obrigatório: `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`. Não foi contratado RPC pago, adicionado endpoint Mainnet ao build Beta ou usado fallback que misture clusters.

O transporte dos testes públicos foi movido para `src/lib/solana/public-rpc-transport.ts` e reutilizado pelo cliente Meteora. O caminho antigo dos testes reexporta a mesma implementação.

- Fila de no máximo 24 solicitações pendentes por contexto e cache de até oito contextos.
- Cliente Meteora: uma requisição em andamento, espaçamento 200ms, prazo por fetch de 7s e no máximo uma repetição adicional de leitura.
- HTTP 429: honra Retry-After até 30s; hints maiores encerram essa tentativa sem retry antecipado. Não promete quota entre abas/dispositivos ou entre clientes diferentes.
- Métodos de envio e corpos desconhecidos nunca são repetidos pelo transporte. Leituras toleram uma repetição de rede/429, sem fabricar saldo zero.
- Leitura via Kit mantém deduplicação do cliente e deadline; backoff foi ampliado para 1s. Cancelamento/timeout não dispara nova tentativa; cluster errado é recusado antes de ler saldo.
- A recuperação de transações pertence ao executor existente, que registra a assinatura antes de enviar e reconcilia as contas/assinaturas. Não substituir esse fluxo por retry do botão.

Evidência atual: [public-devnet-readonly.json](evidence/public-devnet-readonly.json), consulta **somente leitura**, com programas, slot e saldo público. Ela não movimenta fundos nem comprova uma carteira disponível para assinatura.

O funder histórico tem 2,013648909 SOL de teste; o teste de graduação precisa de orçamento próprio, ver [graduação](PUBLIC_GRADUATION_E2E.md). Sem acesso à chave protegida e sem saldo suficiente, nenhuma execução pública financiada foi iniciada.

Em 429 recorrente, reduzir atualizações/concorrência e aguardar. Se ainda impedir o teste, registrar chamadas/horários e avaliar um RPC dedicado com o proprietário. Não contratar ou trocar a rede automaticamente.
