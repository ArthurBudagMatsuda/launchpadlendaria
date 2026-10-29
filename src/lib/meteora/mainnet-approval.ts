import BN from "bn.js";
import packageJson from "../../../package.json";
import {
  FEATURE_DEFAULTS,
  MAINNET_EXECUTION_ENABLED,
  RETRY_DBC_CONFIGS,
  type MainnetApproval,
} from "@/config/retry-protocol";
import { MAX_INITIAL_BUY_LAMPORTS } from "./create-token";
import { RETRY_LAUNCH, retryCurve } from "./curve";
import { DAMM_V2_EVENT_AUTHORITY, DAMM_V2_POOL_AUTHORITY } from "./damm-v2";
import { CpAmmIdl } from "./damm-sdk";
import { graduatedFeeBps } from "./graduation";
import { MAX_NAME, MAX_SYMBOL, MAX_URI } from "./metadata";
import {
  ASSOCIATED_TOKEN_PROGRAM,
  COMPUTE_BUDGET_PROGRAM,
  DAMM_V2_PROGRAM,
  DBC_POOL_AUTHORITY,
  DBC_PROGRAM,
  dammV2ConfigFor,
  LIGHTHOUSE_PROGRAM,
  METAPLEX_PROGRAM,
  SPL_TOKEN_PROGRAM,
  SYSTEM_PROGRAM,
  TOKEN_2022_PROGRAM,
  WSOL_MINT,
} from "./programs";
import { DEFAULT_SLIPPAGE_BPS } from "./quotes";
import {
  DynamicBondingCurveIdl,
  FEE_DENOMINATOR,
  getBaseTokenForSwap,
  getMigrationBaseToken,
  getMigrationQuoteAmountFromThreshold,
  getMigrationThresholdPrice,
  getPriceFromSqrtPrice,
  getProtocolMigrationFee,
  getQuoteFromInputAmount,
  PROTOCOL_FEE_PERCENT,
  PROTOCOL_LIQUIDITY_MIGRATION_FEE_BPS,
  SwapMode,
} from "./sdk";

// Tests and scripts only: the app never imports this module (it pulls in
// both Meteora SDKs to state the figures they compute).

const big = (value: BN | number) => BigInt(new BN(value).toString());

/**
 * Every parameter a Mainnet RETRY launch would run with, read from the code
 * that builds the transactions and computed with Meteora's own SDK helpers:
 * nothing here is typed by hand. Raw units as decimal strings. This object
 * is what the owner approves; its SHA-256 identifies the approval.
 */
export function mainnetApprovalParameters() {
  const curve = retryCurve();
  const supply = big(curve.tokenSupply!.preMigrationTokenSupply);
  const migrationSqrtPrice = getMigrationThresholdPrice(
    curve.migrationQuoteThreshold,
    curve.sqrtStartPrice,
    curve.curve,
  );
  const soldOnCurve = big(
    getBaseTokenForSwap(curve.sqrtStartPrice, migrationSqrtPrice, curve.curve),
  );
  const migrationQuote = getMigrationQuoteAmountFromThreshold(
    curve.migrationQuoteThreshold,
    curve.migrationFee.feePercentage,
  );
  const migrationBase = getMigrationBaseToken(
    migrationQuote,
    migrationSqrtPrice,
    curve.migrationOption,
  );
  const [baseMigrationFee, quoteMigrationFee] = getProtocolMigrationFee(
    migrationBase,
    migrationQuote,
    migrationSqrtPrice,
    PROTOCOL_LIQUIDITY_MIGRATION_FEE_BPS,
    curve.migrationOption,
  );
  const vesting = curve.lockedVesting;
  const config = RETRY_DBC_CONFIGS["mainnet-beta"];
  const deps = packageJson.dependencies;
  // A fresh pool sits at the start price, so the creator's first buy is
  // quoted from the config alone, as the launch screen does.
  const firstBuy = (lamports: bigint) => {
    const quote = getQuoteFromInputAmount({
      config: curve,
      swapBaseForQuote: false,
      amountIn: new BN(lamports.toString()),
      swapMode: SwapMode.ExactIn,
      slippageBps: DEFAULT_SLIPPAGE_BPS,
    });
    return {
      lamports: lamports.toString(),
      tokensOut: big(quote.outputAmount).toString(),
      minimumTokensOut: big(quote.minimumAmountOut!).toString(),
      feeLamports: (big(quote.tradingFee) + big(quote.protocolFee)).toString(),
    };
  };
  return {
    network: "mainnet-beta",
    programs: {
      dynamicBondingCurve: DBC_PROGRAM.toBase58(),
      dynamicBondingCurveIdl: DynamicBondingCurveIdl.metadata.version,
      dammV2: DAMM_V2_PROGRAM.toBase58(),
      dammV2Idl: CpAmmIdl.metadata.version,
      metaplexTokenMetadata: METAPLEX_PROGRAM.toBase58(),
      splToken: SPL_TOKEN_PROGRAM.toBase58(),
      token2022: TOKEN_2022_PROGRAM.toBase58(),
      associatedToken: ASSOCIATED_TOKEN_PROGRAM.toBase58(),
      system: SYSTEM_PROGRAM.toBase58(),
      computeBudget: COMPUTE_BUDGET_PROGRAM.toBase58(),
      lighthouse: LIGHTHOUSE_PROGRAM.toBase58(),
      wsolMint: WSOL_MINT.toBase58(),
      dbcPoolAuthority: DBC_POOL_AUTHORITY.toBase58(),
      dammV2PoolAuthority: DAMM_V2_POOL_AUTHORITY.toBase58(),
      dammV2EventAuthority: DAMM_V2_EVENT_AUTHORITY.toBase58(),
      dammV2MigrationConfig: dammV2ConfigFor(
        RETRY_LAUNCH.migrationFeeOption,
      ).toBase58(),
    },
    packages: {
      "@meteora-ag/dynamic-bonding-curve-sdk":
        deps["@meteora-ag/dynamic-bonding-curve-sdk"],
      "@meteora-ag/cp-amm-sdk": deps["@meteora-ag/cp-amm-sdk"],
      "@solana/web3.js": deps["@solana/web3.js"],
      "@solana/spl-token": deps["@solana/spl-token"],
    },
    token: {
      /** 0 = SPL Token. */
      tokenType: curve.tokenType,
      decimals: curve.tokenDecimal,
      totalSupply: supply.toString(),
      postMigrationSupply: big(
        curve.tokenSupply!.postMigrationTokenSupply,
      ).toString(),
      /** 1 = Immutable: no update authority, no mint authority. */
      tokenUpdateAuthority: curve.tokenUpdateAuthority,
    },
    supply: {
      soldOnCurve: soldOnCurve.toString(),
      depositedAtGraduation: big(migrationBase).toString(),
      leftover: (supply - soldOnCurve - big(migrationBase)).toString(),
      lockedVesting: {
        amountPerPeriod: big(vesting.amountPerPeriod).toString(),
        numberOfPeriod: big(vesting.numberOfPeriod).toString(),
        cliffUnlockAmount: big(vesting.cliffUnlockAmount).toString(),
      },
    },
    curve: {
      sqrtStartPrice: big(curve.sqrtStartPrice).toString(),
      points: curve.curve.map((point) => ({
        sqrtPrice: big(point.sqrtPrice).toString(),
        liquidity: big(point.liquidity).toString(),
      })),
      migrationSqrtPrice: big(migrationSqrtPrice).toString(),
      /** 1 = Timestamp. */
      activationType: curve.activationType,
    },
    tradingFee: {
      cliffFeeNumerator: big(
        curve.poolFees.baseFee.cliffFeeNumerator,
      ).toString(),
      feeDenominator: String(FEE_DENOMINATOR),
      /** 0 = FeeSchedulerLinear; zero periods keep it constant. */
      baseFeeMode: curve.poolFees.baseFee.baseFeeMode,
      schedulerPeriods: curve.poolFees.baseFee.firstFactor,
      dynamicFee: curve.poolFees.dynamicFee !== null,
      /** 0 = QuoteToken: fees are taken in SOL. */
      collectFeeMode: curve.collectFeeMode,
      protocolFeePercent: PROTOCOL_FEE_PERCENT,
      creatorTradingFeePercentage: curve.creatorTradingFeePercentage,
      /** RETRY passes no referral account. */
      referral: false,
      enableFirstSwapWithMinFee: curve.enableFirstSwapWithMinFee,
    },
    otherFees: {
      poolCreationFee: big(curve.poolCreationFee).toString(),
      migrationFeePercentage: curve.migrationFee.feePercentage,
      creatorMigrationFeePercentage: curve.migrationFee.creatorFeePercentage,
      meteoraLiquidityMigrationFeeBps: PROTOCOL_LIQUIDITY_MIGRATION_FEE_BPS,
      /** 2 = FixedBps100. */
      migrationFeeOption: curve.migrationFeeOption,
      graduatedPoolLpFeeBps: graduatedFeeBps() ?? null,
    },
    feeRecipients: {
      /** The config's fee claimer and leftover receiver: RETRY's treasury. */
      treasury: config?.feeClaimer ?? null,
      treasuryKind: config?.feeClaimerKind ?? null,
    },
    initialBuy: {
      maxLamports: MAX_INITIAL_BUY_LAMPORTS.toString(),
      sameTransactionAsCreate: true,
      defaultSlippageBps: DEFAULT_SLIPPAGE_BPS,
      quotes: [100_000_000n, 500_000_000n, 1_000_000_000n].map(firstBuy),
    },
    graduation: {
      migrationQuoteThreshold: big(curve.migrationQuoteThreshold).toString(),
      /** 1 = MET_DAMM_V2. */
      migrationOption: curve.migrationOption,
      solToDammV2: (big(migrationQuote) - big(quoteMigrationFee)).toString(),
      tokensToDammV2: (big(migrationBase) - big(baseMigrationFee)).toString(),
      meteoraMigrationFeeLamports: big(quoteMigrationFee).toString(),
      meteoraMigrationFeeTokens: big(baseMigrationFee).toString(),
    },
    liquidity: {
      partnerLiquidityPercentage: curve.partnerLiquidityPercentage,
      creatorLiquidityPercentage: curve.creatorLiquidityPercentage,
      partnerPermanentLockedLiquidityPercentage:
        curve.partnerPermanentLockedLiquidityPercentage,
      creatorPermanentLockedLiquidityPercentage:
        curve.creatorPermanentLockedLiquidityPercentage,
      partnerLiquidityVestingPercentage:
        curve.partnerLiquidityVestingInfo.vestingPercentage,
      creatorLiquidityVestingPercentage:
        curve.creatorLiquidityVestingInfo.vestingPercentage,
    },
    metadata: {
      maxNameBytes: MAX_NAME,
      maxSymbolBytes: MAX_SYMBOL,
      maxUriBytes: MAX_URI,
    },
    config: {
      dbcConfig: config?.address ?? null,
      createdBy: config?.createdBy ?? null,
      createdAt: config?.createdAt ?? null,
    },
  };
}

export type MainnetApprovalParameters = ReturnType<
  typeof mainnetApprovalParameters
>;

/** Raw units as an exact pt-BR decimal: 1234567,5 → "1.234.567,5". */
function br(raw: bigint, decimals: number) {
  const unit = 10n ** BigInt(decimals);
  const value = raw < 0n ? -raw : raw;
  const whole = (value / unit).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = decimals
    ? (value % unit).toString().padStart(decimals, "0").replace(/0+$/, "")
    : "";
  return `${raw < 0n ? "-" : ""}${whole}${fraction ? `,${fraction}` : ""}`;
}
const solBr = (lamports: string) => `${br(BigInt(lamports), 9)} SOL`;
const tokensBr = (raw: string) => br(BigInt(raw), RETRY_LAUNCH.decimals);
/** part / whole in percent, truncated to `places` decimals. */
const pctBr = (part: string, whole: string, places = 4) =>
  `${br((BigInt(part) * 100n * 10n ** BigInt(places)) / BigInt(whole), places)}%`;
const priceBr = (sqrtPrice: string) =>
  getPriceFromSqrtPrice(new BN(sqrtPrice), RETRY_LAUNCH.decimals, 9)
    .toSignificantDigits(8)
    .toFixed()
    .replace(".", ",");
const fdvBr = (sqrtPrice: string) =>
  getPriceFromSqrtPrice(new BN(sqrtPrice), RETRY_LAUNCH.decimals, 9)
    .mul(RETRY_LAUNCH.totalSupply)
    .toDecimalPlaces(4)
    .toFixed()
    .replace(".", ",");
const code = (value: string | number | null) =>
  value === null ? "**pendente**" : `\`${value}\``;

/** Whether `approval` approves exactly the parameters with this hash. */
export function approvalMatches(
  approval: MainnetApproval | null,
  sha256: string,
) {
  return approval !== null && approval.parametersSha256 === sha256;
}

/**
 * The sheet the owner reads and approves, in Portuguese like the rest of
 * the docs. Generated, never edited: tests/mainnet-approval.test.ts fails
 * when docs/meteora-mvp/MAINNET_APPROVAL.md differs from this output.
 */
export function mainnetApprovalSheet(
  p: MainnetApprovalParameters,
  sha256: string,
  approval: MainnetApproval | null,
) {
  const mainnetFeatures = FEATURE_DEFAULTS["mainnet-beta"];
  const featuresOn = Object.entries(mainnetFeatures)
    .filter(([, on]) => on)
    .map(([name]) => name);
  const state = approvalMatches(approval, sha256)
    ? `**Aprovado** por ${approval!.approvedBy} em ${approval!.approvedAt} (${approval!.reference}).`
    : approval
      ? `**Aprovação desatualizada.** A aprovação registrada (${approval.approvedAt}) é de outro conjunto de parâmetros (\`${approval.parametersSha256}\`). A Mainnet fica travada até uma nova aprovação.`
      : "**Aguardando aprovação do proprietário.**";
  const pending = [
    p.feeRecipients.treasury
      ? null
      : "Tesouraria RETRY (fee claimer e leftover receiver da config): não definida. Recomendado multisig (ex.: Squads).",
    p.feeRecipients.treasury && p.feeRecipients.treasuryKind !== "treasury"
      ? "O fee claimer registrado não está marcado como tesouraria."
      : null,
    p.config.dbcConfig
      ? null
      : "Config DBC da Mainnet: não criada. Ela é criada pela tesouraria com `createConfig2` depois da aprovação, e o endereço entra em `RETRY_DBC_CONFIGS` (o que muda o hash desta folha e exige aprovar de novo, já com o endereço).",
  ].filter(Boolean);
  const q = p.initialBuy.quotes;
  const supply = p.token.totalSupply;
  const vesting = p.supply.lockedVesting;
  const vestingTotal =
    BigInt(vesting.cliffUnlockAmount) +
    BigInt(vesting.amountPerPeriod) * BigInt(vesting.numberOfPeriod);
  const lines = [
    "# Aprovação da Mainnet: parâmetros de um lançamento RETRY",
    "",
    "<!-- Gerado por src/lib/meteora/mainnet-approval.ts. Não editar: `pnpm vitest run tests/mainnet-approval.test.ts -u` regenera. -->",
    "",
    "Esta folha é gerada a partir do código que monta as transações, com as funções do próprio SDK da Meteora para os números derivados. Nada aqui foi digitado à mão: o teste `tests/mainnet-approval.test.ts` falha se o código e esta folha divergirem.",
    "",
    `Estado: ${state}`,
    "",
    `Execução na Mainnet: ${MAINNET_EXECUTION_ENABLED ? "**ligada**" : "travada"} (\`MAINNET_EXECUTION_ENABLED = ${MAINNET_EXECUTION_ENABLED}\`). Funções ligadas por padrão na Mainnet: ${featuresOn.length ? featuresOn.map((name) => `\`${name}\``).join(", ") : "nenhuma"}.`,
    "",
    `SHA-256 dos parâmetros: \`${sha256}\``,
    "",
    "O hash é o SHA-256 de `JSON.stringify` do bloco JSON no fim desta folha (sem espaços). Qualquer mudança de parâmetro, de programa ou de versão de SDK muda o hash.",
    "",
    "## Como aprovar",
    "",
    "1. Ler as seções abaixo e resolver as pendências.",
    "2. Registrar a aprovação em `MAINNET_APPROVAL` (`src/config/retry-protocol.ts`) num PR revisado, com este hash, o nome de quem aprova, a data e o link da aprovação.",
    '3. Só depois, em outro PR revisado, ligar `MAINNET_EXECUTION_ENABLED` e as funções em `FEATURE_DEFAULTS["mainnet-beta"]`. O teste recusa ligar a Mainnet sem uma aprovação deste hash exato.',
    "",
    "O resto do processo (revisão de segurança, carteiras reais, Worker, RPC, monitoramento) está em [MAINNET_RELEASE_CHECKLIST.md](MAINNET_RELEASE_CHECKLIST.md).",
    "",
    "## Pendências que o código mostra",
    "",
    ...(pending.length
      ? pending.map((item) => `- ${item}`)
      : ["- Nenhuma nesta folha."]),
    "",
    "## Token",
    "",
    "| Parâmetro | Valor |",
    "| --- | --- |",
    `| Padrão | ${p.token.tokenType === 0 ? "SPL Token (não Token-2022)" : `tipo ${p.token.tokenType}`} |`,
    `| Decimals | ${p.token.decimals} |`,
    `| Supply total | ${tokensBr(supply)} tokens (\`${supply}\` unidades) |`,
    `| Supply depois da graduação | ${tokensBr(p.token.postMigrationSupply)} tokens (fixo) |`,
    `| Autoridades | ${p.token.tokenUpdateAuthority === 1 ? "`Immutable`: sem autoridade de mint, de freeze e de metadados depois da criação (verificado on-chain no teste de chain)" : `opção ${p.token.tokenUpdateAuthority}`} |`,
    "",
    "## Supply e reservas",
    "",
    "| Destino | Tokens | % do supply |",
    "| --- | --- | --- |",
    `| Vendido na curva (até o threshold) | ${tokensBr(p.supply.soldOnCurve)} | ${pctBr(p.supply.soldOnCurve, supply)} |`,
    `| Depositado no DAMM v2 na graduação | ${tokensBr(p.supply.depositedAtGraduation)} | ${pctBr(p.supply.depositedAtGraduation, supply)} |`,
    `| Leftover | ${tokensBr(p.supply.leftover)} | ${pctBr(p.supply.leftover, supply)} |`,
    `| Vesting travado (alocação do criador) | ${vestingTotal ? tokensBr(vestingTotal.toString()) : "nenhum"} | ${pctBr(vestingTotal.toString(), supply)} |`,
    "",
    "A pool começa com todo o supply no cofre de tokens e 0 SOL no cofre de SOL. Não há reserva virtual: o preço vem da curva de liquidez concentrada do DBC sobre saldos reais.",
    "",
    "## Curva",
    "",
    "| Parâmetro | Valor |",
    "| --- | --- |",
    `| Preço inicial | ${priceBr(p.curve.sqrtStartPrice)} SOL por token (FDV ${fdvBr(p.curve.sqrtStartPrice)} SOL) |`,
    `| Preço na graduação | ${priceBr(p.curve.migrationSqrtPrice)} SOL por token (FDV ${fdvBr(p.curve.migrationSqrtPrice)} SOL) |`,
    `| \`sqrtStartPrice\` | \`${p.curve.sqrtStartPrice}\` |`,
    ...p.curve.points.map(
      (point, i) =>
        `| Ponto ${i + 1} da curva | sqrtPrice \`${point.sqrtPrice}\`, liquidez \`${point.liquidity}\` |`,
    ),
    `| \`migrationSqrtPrice\` | \`${p.curve.migrationSqrtPrice}\` (o DAMM v2 abre exatamente neste preço) |`,
    `| Ativação | ${p.curve.activationType === 1 ? "por timestamp, imediata" : `tipo ${p.curve.activationType}`} |`,
    "",
    "## Taxas",
    "",
    "| Taxa | Valor |",
    "| --- | --- |",
    `| Negociação na curva | ${br((BigInt(p.tradingFee.cliffFeeNumerator) * 10_000n) / BigInt(p.tradingFee.feeDenominator), 2)}% fixa (\`${p.tradingFee.cliffFeeNumerator}\` / \`${p.tradingFee.feeDenominator}\`, ${p.tradingFee.schedulerPeriods} períodos de redução) |`,
    `| Taxa dinâmica | ${p.tradingFee.dynamicFee ? "ligada" : "desligada"} |`,
    `| Cobrada em | ${p.tradingFee.collectFeeMode === 0 ? "SOL" : `modo ${p.tradingFee.collectFeeMode}`} |`,
    `| Parte da Meteora | ${p.tradingFee.protocolFeePercent}% da taxa |`,
    `| Parte do criador | ${p.tradingFee.creatorTradingFeePercentage}% do restante |`,
    `| Parte da RETRY | ${100 - p.tradingFee.creatorTradingFeePercentage}% do restante |`,
    `| Referral | ${p.tradingFee.referral ? "sim" : "nenhum"} |`,
    `| Primeira compra com taxa mínima | ${p.tradingFee.enableFirstSwapWithMinFee ? "ligada" : "desligada"} |`,
    `| Criação de pool | ${solBr(p.otherFees.poolCreationFee)} |`,
    `| Taxa de migração da RETRY / do criador | ${p.otherFees.migrationFeePercentage}% / ${p.otherFees.creatorMigrationFeePercentage}% |`,
    `| Taxa de liquidez da Meteora na graduação | ${br(BigInt(p.otherFees.meteoraLiquidityMigrationFeeBps), 2)}% do SOL e dos tokens migrados |`,
    `| LP fee do DAMM v2 depois da graduação | ${p.otherFees.graduatedPoolLpFeeBps === null ? "**desconhecida**" : `${br(BigInt(p.otherFees.graduatedPoolLpFeeBps), 2)}%`} (opção \`${p.otherFees.migrationFeeOption}\`, config \`${p.programs.dammV2MigrationConfig}\`) |`,
    "",
    "## Quem recebe",
    "",
    "| O quê | Quem |",
    "| --- | --- |",
    `| Parte RETRY das taxas da curva | tesouraria ${code(p.feeRecipients.treasury)} |`,
    `| Leftover, se houver (${tokensBr(p.supply.leftover)} tokens nesta config) | tesouraria ${code(p.feeRecipients.treasury)} |`,
    "| Parte do criador | a carteira que criou a pool (sacada por ela, em SOL) |",
    `| Posição de LP travada do parceiro (NFT) | tesouraria ${code(p.feeRecipients.treasury)} |`,
    "| Posição de LP travada do criador (NFT) | o criador |",
    "| Taxas de LP do DAMM v2 | quem tiver a NFT de cada posição |",
    "",
    "## Compra inicial do criador",
    "",
    `Opcional, de 0 a ${solBr(p.initialBuy.maxLamports)}, na mesma transação da criação (ninguém compra antes do criador). Slippage padrão ${br(BigInt(p.initialBuy.defaultSlippageBps), 2)}%. Cotações do SDK sobre a pool recém-criada:`,
    "",
    "| Compra | Tokens | % do supply | Mínimo com slippage | Taxa |",
    "| --- | --- | --- | --- | --- |",
    ...q.map(
      (quote) =>
        `| ${solBr(quote.lamports)} | ${tokensBr(quote.tokensOut)} | ${pctBr(quote.tokensOut, supply)} | ${tokensBr(quote.minimumTokensOut)} | ${solBr(quote.feeLamports)} |`,
    ),
    "",
    "## Graduação",
    "",
    "| Parâmetro | Valor |",
    "| --- | --- |",
    `| Threshold | ${solBr(p.graduation.migrationQuoteThreshold)} na curva |`,
    `| Destino | ${p.graduation.migrationOption === 1 ? "Meteora DAMM v2" : `opção ${p.graduation.migrationOption}`} |`,
    `| SOL depositado no DAMM v2 | ${solBr(p.graduation.solToDammV2)} (taxa da Meteora: ${solBr(p.graduation.meteoraMigrationFeeLamports)}) |`,
    `| Tokens depositados no DAMM v2 | ${tokensBr(p.graduation.tokensToDammV2)} (taxa da Meteora: ${tokensBr(p.graduation.meteoraMigrationFeeTokens)}) |`,
    "| Quem migra na Mainnet | o keeper da Meteora; a migração manual (sem permissão) fica como reserva |",
    "",
    "## Liquidez graduada",
    "",
    "| | RETRY (parceiro) | Criador |",
    "| --- | --- | --- |",
    `| Livre para retirar | ${p.liquidity.partnerLiquidityPercentage}% | ${p.liquidity.creatorLiquidityPercentage}% |`,
    `| Travada para sempre | ${p.liquidity.partnerPermanentLockedLiquidityPercentage}% | ${p.liquidity.creatorPermanentLockedLiquidityPercentage}% |`,
    `| Em vesting | ${p.liquidity.partnerLiquidityVestingPercentage}% | ${p.liquidity.creatorLiquidityVestingPercentage}% |`,
    "",
    "O DBC arredonda para baixo a parte travada de cada posição: no teste de chain sobrou 1 unidade de liquidez destravada (contra ≈ 4,1 × 10³² travadas por posição). O painel de graduação verifica o travamento lendo as posições.",
    "",
    "## Metadados",
    "",
    `Metaplex Token Metadata, imutáveis (update authority = System Program, \`isMutable = false\`, verificado on-chain). Nome até ${p.metadata.maxNameBytes} bytes, ticker até ${p.metadata.maxSymbolBytes}, URI até ${p.metadata.maxUriBytes}. JSON e imagem ficam no Worker RETRY, endereçados pelo SHA-256 do conteúdo (\`NEXT_PUBLIC_RETRY_METADATA_URL\`).`,
    "",
    "## Programas, contas fixas e SDKs",
    "",
    "| | Endereço ou versão |",
    "| --- | --- |",
    `| Meteora DBC | \`${p.programs.dynamicBondingCurve}\` (IDL ${p.programs.dynamicBondingCurveIdl}) |`,
    `| Meteora DAMM v2 | \`${p.programs.dammV2}\` (IDL ${p.programs.dammV2Idl}) |`,
    `| Config DAMM v2 da graduação | \`${p.programs.dammV2MigrationConfig}\` |`,
    `| Pool authority do DBC | \`${p.programs.dbcPoolAuthority}\` |`,
    `| Pool authority do DAMM v2 | \`${p.programs.dammV2PoolAuthority}\` |`,
    `| Event authority do DAMM v2 | \`${p.programs.dammV2EventAuthority}\` |`,
    `| Metaplex Token Metadata | \`${p.programs.metaplexTokenMetadata}\` |`,
    `| SPL Token | \`${p.programs.splToken}\` |`,
    `| Token-2022 (NFTs das posições) | \`${p.programs.token2022}\` |`,
    `| Associated Token | \`${p.programs.associatedToken}\` |`,
    `| System | \`${p.programs.system}\` |`,
    `| Compute Budget | \`${p.programs.computeBudget}\` |`,
    `| Lighthouse (só quando a carteira acrescenta) | \`${p.programs.lighthouse}\` |`,
    `| WSOL | \`${p.programs.wsolMint}\` |`,
    ...Object.entries(p.packages).map(
      ([name, version]) => `| \`${name}\` | ${version} |`,
    ),
    "",
    "## Config RETRY na Mainnet",
    "",
    "| | |",
    "| --- | --- |",
    `| Config DBC | ${code(p.config.dbcConfig)} |`,
    `| Transação de criação | ${code(p.config.createdBy)} |`,
    `| Data | ${code(p.config.createdAt)} |`,
    "",
    "## Parâmetros completos",
    "",
    "```json",
    JSON.stringify(p, null, 2),
    "```",
    "",
  ];
  return lines.join("\n");
}
