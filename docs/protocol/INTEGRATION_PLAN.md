# Integração segura e proveniência

## Snapshot antes de alterações

Em 26/10/2026, foi executado fetch e inspecionadas as três branches publicadas:

| Fonte | Commit completo | Função |
|---|---|---|
| origin/main | c1b0f89518689ff2c01871037a7b8f9484cac3ee | Base neutra: README e Pages workflow |
| origin/feat/etapa-1-foundation | 2c8a156b784796f51fd2e028ba81af39936e3dd0 | Aplicação e documentação existentes |
| origin/feat/etapa-2-web3 | f62473c1f0b5344e74266e386657f2f251b4c6ab | Módulo de carteira e bancada independente |

main e Web3 têm ancestral ebfef93d9dda07d36e34624c3fa3e2f338fd9ac8. Fundação não tem merge-base com essas branches. O diretório original estava limpo e permaneceu na Fundação. Não usar merge de históricos desconectados automaticamente; não foi usado --allow-unrelated-histories.

A branch `feat/retry-protocol-architecture` foi criada de origin/main em worktree isolado. O pacote novo depende apenas de Node, não de arquivos das outras branches. Não se moveu HEAD de outro agente nem se reaproveitou um worktree de outra tarefa.

## Escopo exclusivo desta branch

Novos arquivos em docs/protocol, packages/protocol-simulator, workflow específico de verificação e regras LF limitadas a esses caminhos. README, Pages workflow, aplicação, docs existentes e módulo Web3 não são alterados. Não há merge na main, reset, force push, publicação do site ou habilitação de operação financeira.

## Plano de integração posterior

1. Atualizar refs e registrar novos heads no momento da integração; alterações de outros agentes podem ocorrer durante esta fase.
2. Revisar a branch de protocolo por diff contra main. Como compartilha a base de main, seu PR futuro é convencional e preserva todos os commits desta fase. A publicação da branch não é autorização de merge.
3. Manter a integração Fundação/main como trabalho distinto. Opção conservadora: aplicar em branch de integração um patch limitado aos arquivos necessários, com revisão humana, autor/coautor e SHA de origem no commit e em manifesto. Isso preserva proveniência e os commits originais na branch de origem, mas não cria automaticamente ancestralidade Git entre históricos.
4. Se preservar todo o grafo da Fundação dentro de main for requisito, preparar proposta específica de importação e revisar colisões, workflows e árvore resultante antes de autorização. Não executar uma mesclagem de históricos desconectados só para resolver a divergência.
5. Incorporar o pacote Web3 por PR separado, usando sua base comum com main e o guia de integração existente. Revisar mudanças no Pages workflow e arquivos já compartilhados; não aplicar patch antigo cegamente.
6. Configurar os pacotes do monorepo, escopo de TS/formatadores e versões; usar uma única composição Wagmi/Query. Preservar o modo estático do Pages: importar next/headers para cookies torna a rota dinâmica e precisa de arquitetura distinta.
7. Adicionar ABIs/manifestos do protocolo ao módulo existente apenas após implementação, aprovação e implantação autorizada. Rede desconhecida, código ausente ou endereço não verificado mantém operações desabilitadas.

O patch de integração Web3 referenciado pela branch existente usa Fundação 2c8a156 como base; ele é evidência de compatibilidade pretendida, não de integração já aplicada. Um git apply --check isolado e as verificações completas são necessários na versão final da árvore.

## Dívida identificada, não modificada nesta fase

- Fundação e Web3 possuem providers que devem ser conciliados; pnpm na raiz e npm nos pacotes ainda separados.
- tsconfig da Fundação alcança TS/TSX amplamente; ao integrar packages/examples, definir boundaries para testes e aliases.
- Formatação da raiz usa Prettier e o pacote Web3 usa Biome; limitar escopo em vez de reformatar o trabalho inteiro.
- O workflow Pages passa VITE_DEFAULT_CHAIN, enquanto o playground usa VITE_DEFAULT_NETWORK; default Sepolia mascara essa divergência.
- O publicador está copiado em três branches e não integra os códigos; manter sincronização deliberada.
- Os modelos demonstrativos precisam de chainId, endereços e BigInt na camada de execução futura.

Não foram enviadas mensagens a outros chats/agentes. Coordenação futura deve ocorrer através de diffs, PRs e autorização de comunicação quando aplicável.
