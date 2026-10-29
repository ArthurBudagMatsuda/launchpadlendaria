# RETRY — Validação real da Phantom na versão Solana

Estado em 29/10/2026: **PENDENTE**. O operador informou anteriormente que não dispõe de carteira exclusiva de testes. A nova etapa não autoriza usar carteira pessoal ou criar/importar uma conta por ele. Nenhuma extensão real foi conectada nem assinatura de carteira pessoal solicitada. A chave CI criada com autorização é distinta e fica protegida fora do navegador.

Funder/secret foram automatizados com autorização e financiamento confirmado por RPC. Dispatch permanece indisponível na default branch; testes on-chain usam alternativa local protegida. Worker preparado, sem autenticação Cloudflare ou autorização de deploy. O ciclo completo Create no navegador real continua pendente.

## Preview

O site público antigo não foi tratado como versão Solana. Sem merge em `main`, deploy externo ou URL pública nova. `preview-validation.yml` gera somente artefato. Publicar uma URL exige autorização própria.

Preview **local** reproduzível desta branch:

```powershell
$env:NEXT_PUBLIC_SOLANA_CLUSTER = 'devnet'
pnpm build:pages
$env:PORT = '4188'
pnpm preview:pages
```

Abrir `http://127.0.0.1:4188/launchpadlendaria/` em navegador real com extensão oficial e conta descartável do operador. O servidor atende somente loopback, enquanto o processo estiver ativo; não é URL de internet nem acessível por celular remoto.

A config Devnet foi criada e registrada; o Worker real ainda falta, mantendo o lançamento pelo navegador bloqueado. `MAINNET_EXECUTION_ENABLED=false` continua constante. Não importar o funder CI na extensão/frontend/build.

## Procedimento humano

1. Perfil isolado, [Phantom oficial](https://phantom.com/) e conta exclusiva, sem fundos relevantes. Instalação/criação/desbloqueio pelo operador; não compartilhar seed/senha. Registrar extensão, navegador, SO, origem e SHA.
2. Conectar à versão Solana local/preview autorizado. Aprovar só conexão. Consulta de SOL/endereço não deve pedir assinatura. Comparar endereço e saldo com RPC/Explorer **Devnet**.
3. Executar matriz com evidência sem dados pessoais desnecessários.
4. Para operações Meteora, preparar config/Worker e obter autorização explícita do controlador da carteira **antes do fluxo financeiro manual**. Autorizar CI não substitui aprovação na extensão. Nunca enviar à Mainnet.

## Matriz real

| Caso               | Esperado                                            | Estado               | Evidência                             |
| ------------------ | --------------------------------------------------- | -------------------- | ------------------------------------- |
| P01 Detecção       | Extensão oficial aparece uma vez                    | Pendente             | Não executado                         |
| P02 Seletor        | Phantom Solana selecionável                         | Pendente             | Não executado                         |
| P03 Autorização    | Prompt real, somente conexão                        | Pendente             | Não executado                         |
| P04 Endereço       | Coincide com conta Solana                           | Pendente             | Não executado                         |
| P05 Cluster        | Devnet explícita/genesis correto                    | Pendente na extensão | RPC independente não aprova este caso |
| P06 SOL            | Leitura real sem assinatura                         | Pendente             | Falta conta de teste                  |
| P07 Navegação      | Sessão Discover/Create/Portfolio preservada         | Pendente real        | Mocks não equivalem à extensão        |
| P08 Reload         | Reconexão silenciosa já autorizada quando suportada | Pendente             | Não executado                         |
| P09 Desconexão     | Identidade/saldo limpos                             | Pendente             | Não executado                         |
| P10 Reconexão      | Conexão novamente pelo seletor                      | Pendente             | Não executado                         |
| P11 Rejeição       | Desconectada com mensagem correta                   | Pendente             | Não executado                         |
| P12 Conta          | Endereço/saldo atualizam juntos                     | Pendente             | Não executado                         |
| P13 RPC falho      | Indisponibilidade, não zero fictício                | Pendente real        | Simulação apenas no CI                |
| P14 Create         | Rascunho/preview, bloqueio sem infraestrutura       | Pendente real        | Worker real e extensão faltam         |
| P15 Prévia Meteora | Simulação/custo antes de aprovar                    | Pendente             | Recursos + autorização do operador    |

Versão Phantom, SO e navegador **reais**: não utilizados/não registrados. Não inferir instalação/suporte por mocks. Mobile e coexistência com Solflare/Backpack permanecem na [matriz geral](SOLANA_REAL_WALLET_TEST_MATRIX.md).

## Evidência

**AUTOMATIZADO SIMULADO:** Wallet Standard/RPC/Access em fixtures. **REAL AUTOMATIZADO:** extensão oficial de fato usada; nenhum caso. **REAL MANUAL:** operador executou e registrou; nenhum caso. **PENDENTE:** não executado. **FALHOU:** executado e reprovado, nunca presumido.

Registrar caso, origem, SHA, versões, data, esperado/obtido e evidência. Abreviar endereços quando possível; nunca capturar recuperação/segredos. Repetir na origem pública autorizada: localhost não comprova cookies, CORS, permissões da extensão ou domínio final.
