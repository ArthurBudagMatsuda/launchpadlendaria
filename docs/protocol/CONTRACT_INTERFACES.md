# Interfaces e eventos candidatos

Esboços documentais para revisão. **Não são arquivos Solidity compilados, ABIs finais ou contratos executáveis.** Cada valor econômico permanece pendente no [DECISION_LOG](DECISION_LOG.md). Endereços são por rede e instância; interfaces não autorizam implantação.

## Tipos

```solidity
enum Stage { Creating, Active, Ready, Migrating, Graduated }

struct EconomicConfig {
    uint256 supply;
    uint256 curveInventory;
    uint256 lpReserve;
    uint256 virtualTokenReserve;
    uint256 virtualEthReserve;
    uint256 graduationRealEth;
    uint256 launchFeeWei;
    uint256 creatorMinNetWei;
    uint16 buyFeeBps;
    uint16 sellFeeBps;
    uint16 creatorFeeShareBps;
    uint16 holdingCapBps;
}

struct LaunchRequest {
    string name;
    string ticker;
    string metadataURI;
    bytes32 metadataDigest;
    bytes32 expectedConfigHash;
    uint256 creatorGrossBuyWei;
    uint256 minCreatorTokensOut;
    uint256 deadline;
}

struct BuyQuote {
    uint256 grossWei;
    uint256 feeWei;
    uint256 netReserveWei;
    uint256 tokensOut;
    uint256 remainingNetToGraduation;
    bool reachesGraduation;
}

struct SellQuote {
    uint256 tokensIn;
    uint256 grossWei;
    uint256 feeWei;
    uint256 netWei;
}
```

DEX adapter, locker, vault, creator e treasury são vinculados à configuração de lançamento separadamente. ConfigHash deve usar `abi.encode` versionado de todos os termos relevantes, chainId e endereços; documentar exatamente a ordem na Fase 3. Deadline é timestamp de execução, não número de blocos.

## Superfície por contrato

| Contrato | Funções conceituais | Restrições |
|---|---|---|
| Factory | `launch(LaunchRequest) payable -> (token, curve)`; `canonicalizeName/Ticker`; `nameCount`; `tickerCount`; `creatorPairUsed`; `launchInfo`; `configHash` | Creator é msg.sender no MVP; sem remetente fornecido livremente; reentrancy guard; nenhuma função para liberar vagas |
| Token | ERC-20 padrão; `curve()`; `holdingCap()`; `stage()` | Inicialização só Factory e uma vez; transições somente da curva autorizada; nenhum setter público de cap, saldo ou oferta |
| Curve | `quoteBuy(grossWei)`; `quoteSell(tokensIn)`; `buy(recipient,minTokensOut,deadline) payable`; `sell(tokensIn,minEthOut,recipient,deadline)`; `graduate()`; opção `buyAndGraduate(...) payable`; `reserves()`; `economicConfig()`; `stage()` | Em buy, msg.value é todo o gross; sell debita msg.sender por allowance; minOut líquido; graduation usa destinos fixados e guards |
| FeeVault | `depositTradeFee(token) payable`; `creditLaunchFee/refund` autenticados; `creditLpFees` autenticado; `claim(token,asset,amount,recipient)`; `claimRefund(amount,recipient)`; `creditOf` | Configuração da divisão vem de registro imutável; separar restituições de receitas; titular do crédito escolhe seu destinatário, sem acesso a terceiros |
| GraduationManager | `migrate(token,curve,settlementHash) -> (pool,positionId,liquidity,used0,used1)`; `previewSettlement(...) view` | Somente curva correspondente registrada; parâmetros derivam de estado/config, não calldata livre; sem executor genérico |
| LiquidityLocker | `registerMintedPosition(...)`; `lockedPosition(token)`; `collectFees(token)`; `lockedSurplus(token,asset)` | Somente manager registra resultado da mint autorizada; collect permissionless com destinatário imutável; sem approve/permit/transfer/decrease/burn arbitrários |
| Governance | Timelock padrão; `queue/executeFutureConfig`; leitura de operações agendadas | Guardas no alvo, limites aprovados, aplicação só em lançamentos futuros; sem autoridade de principal |

FeeVault deve verificar fonte por registro da Factory e calcular a divisão deterministicamente. Não aceitar uma lista arbitrária de beneficiários enviada por qualquer caller. Taxas LP podem vir em RETRY token e WETH: conferir ativo permitido, entrada efetiva e creditar no mesmo ativo; conversão automática para ETH não é parte do MVP. Ledger por `(launchToken, asset, beneficiary)`; refunds nativos separados por pagador. A fonte não pode inventar créditos sem transferir ativos.

## Eventos

Esquema candidato; nomes e campos devem ser congelados junto à ABI. Identidade de rede e bloco vem do receipt, não de um campo controlado por usuário.

```solidity
event LaunchCreated(address indexed token, address indexed curve, address indexed creator,
    bytes32 nameId, bytes32 tickerId, bytes32 configHash, string canonicalName, string canonicalTicker);
event MetadataDeclared(address indexed token, string uri, bytes32 digest);
event CreatorInitialBuy(address indexed token, address indexed creator,
    uint256 grossWei, uint256 feeWei, uint256 netReserveWei, uint256 tokensOut);
event Bought(address indexed token, address indexed payer, address indexed recipient,
    uint256 grossWei, uint256 feeWei, uint256 netReserveWei, uint256 tokensOut, uint256 realReserveAfter);
event Sold(address indexed token, address indexed seller, address indexed recipient,
    uint256 tokensIn, uint256 grossWei, uint256 feeWei, uint256 netWei, uint256 realReserveAfter);
event FeeAccrued(address indexed token, address indexed asset, address indexed beneficiary, uint256 amount);
event FeeClaimed(address indexed token, address indexed asset, address indexed beneficiary,
    address recipient, uint256 amount);
event RefundCredited(address indexed payer, uint256 amount);
event RefundClaimed(address indexed payer, address indexed recipient, uint256 amount);
event StageChanged(address indexed token, Stage previous, Stage current);
event Graduated(address indexed token, address indexed pool, address indexed locker,
    uint256 positionId, uint128 liquidity, uint256 tokenAmount, uint256 quoteAmount);
event PositionLocked(address indexed token, address indexed positionManager, uint256 indexed positionId,
    uint128 initialLiquidity, int24 tickLower, int24 tickUpper);
event LpFeesCollected(address indexed token, address indexed asset, uint256 amount);
event SettlementSurplusLocked(address indexed token, address indexed asset, uint256 amount);
event FutureConfigScheduled(bytes32 indexed operationId, bytes32 indexed configHash, uint256 executableAt);
event FutureConfigActivated(bytes32 indexed configHash);
```

Evitar contar a compra inicial duas vezes no indexador: especificar `CreatorInitialBuy` como anotação da mesma compra, enquanto `Bought` é o único evento de volume. FeeAccrued é passivo por beneficiário, não novo volume negociado. StageChanged pode registrar READY→ACTIVE quando há resgate antes da migração. Eventos revertidos não aparecem em receipts canônicos; não registrar um evento de falha e depois reverter esperando preservá-lo.

Erros candidatos: InvalidIdentifier, NameLimit, TickerLimit, CreatorPairUsed, ConfigChanged, InsufficientCreatorBuy, HoldingCap, InsufficientRealReserve, Slippage, Expired, WrongStage, ThresholdExcess, Dust, UnauthorizedSource, InsufficientCredit, UnsafePool, InvalidPosition, AlreadyGraduated. Frontend deve mapear códigos a mensagens sem usar fallback demonstrativo.

## Invariantes de implementação

Além de [ECONOMICS](ECONOMICS.md), exigir: registros imutáveis; oferta emitida uma vez; cap nas duas rotas de transferência; claims limitados por créditos; nenhuma soma de passivos sem ativos; alterações administrativas não afetam configurações já lançadas; posição bloqueada nunca reduz liquidity e nunca muda de owner; somente o caminho de graduação validado finaliza o estágio.
