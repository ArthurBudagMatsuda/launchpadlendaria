# RETRY — Decisões econômicas pendentes na Solana

Os documentos anteriores da Base são históricos. Nenhuma taxa, reserva virtual, limite de graduação ou proporção de LP antiga foi convertida trocando ETH por SOL. O frontend não cobra nem calcula taxas RETRY. Presets de compra e de slippage antigos foram retirados do painel.

| Item a aprovar       | O que falta para decidir                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| Emissão e decimals   | Supply bruto dentro de `u64`, fracionamento e compatibilidade DEX; 1 bilhão/9 é somente proposta |
| Curva                | Família matemática, reservas iniciais, preço inicial/final, invariantes e arredondamento         |
| Distribuição         | Percentuais vendidos, liquidez, vesting e destino de sobras; soma de 100% e conservação          |
| Quote asset          | SOL nativo vs WSOL dentro do programa; contabilizar wrapping, rent e fechamento de contas        |
| Graduação            | Gatilho em reservas reais, não apenas market cap visual; continuidade de preço e liquidez mínima |
| Taxas                | Criador, protocolo, parceiro, migração e DEX; denominadores e momento de cobrança separados      |
| Liquidez             | Burn real, escrow permanente ou vesting; quem recebe LP/position NFT e direitos de taxas         |
| Administração        | Pausa, upgrade, multisig, timelock, autoridade sobre vaults e políticas de emergência            |
| Custos de rede       | Rent, prioridade, compute e custos de criação de pool medidos no ambiente alvo                   |
| Proteção de execução | Slippage, minimum out, dust, MEV, expiração, limites e falhas de CPI                             |

Antes da implementação financeira: produzir simulação reproduzível com unidades explícitas, cenários extremos, buys/sells sequenciais, ida/volta, arredondamento adversarial e tentativa de esgotamento da reserva. Comparar quote off-chain e resultado on-chain por propriedades. Se integrar LaunchLab ou DBC, usar as regras do programa e suas configurações verificadas; não pressupor que qualquer tokenomics RETRY pode ser imposta sobre ele.

Critério para avançar: documento econômico aprovado, escolha de rota DEX, modelo de ameaças e plano de testes. Nenhuma aprovação de arquitetura nesta migração autoriza mainnet, movimentação de fundos ou implementação financeira não revisada.
