# RETRY — Open economic and security decisions

**Status: all items below are unresolved. No production parameter is selected.** Demonstration metrics and trading illustration ratios are unrelated to these decisions.

| Topic                   | Decision required                                            | Evidence before approval                                                           |
| ----------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Default supply          | Fixed/variable supply, decimals, mint/burn authority         | ERC-20 compatibility, distribution model, privilege review                         |
| Bonding curve           | Function, invariant, rounding and terminal state             | Mathematical specification, adversarial simulations, invariant/property tests      |
| Real/virtual reserves   | Initial and evolving reserve accounting                      | Solvency proofs, withdrawal rules, boundary/rounding analysis                      |
| Launch fees             | Amount/currency, collection and refund policy                | Sustainable cost model, disclosure, jurisdiction review                            |
| Buy/sell fees           | Rates, rounding and collection destinations                  | Market simulations and explicit execution accounting                               |
| Creator revenue         | Eligibility, vesting and payout mechanism                    | Abuse/incentive analysis, tax/legal and permission review                          |
| Graduation              | Thresholds and one-way transition conditions                 | Invariant checks, liveness, race conditions and manipulation analysis              |
| Liquidity migration     | DEX, pair, allocation, price mapping and liquidity ownership | DEX compatibility, front-running analysis, migration simulation and locking policy |
| Administrative controls | Immutability/upgrades, pausing, roles and timelocks          | Threat model, multisig/process design, incident-response limits                    |
| Safety                  | Slippage, deadlines, reserves, reentrancy, MEV and recovery  | Independent review/audit, fuzzing, full testnet exercises                          |

Record future decisions with owner, rationale, mathematical/economic evidence, threat model, review date and explicit approval status. User-facing summaries must remain `To be defined`/`Coming soon` until decisions are adopted. A UI example is never an implicit parameter decision.
