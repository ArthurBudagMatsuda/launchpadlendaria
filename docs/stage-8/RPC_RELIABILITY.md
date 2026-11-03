# RPC e confiabilidade

RPC pública gratuita Devnet: `https://api.devnet.solana.com`. Genesis esperado `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`. [Sonda de pré-requisitos](evidence/public-devnet-readonly.json) e [saldo da Phantom](evidence/phantom-owner-and-balance.json) conferiram a rede antes das conclusões.

O transporte existente usa fila limitada, timeout, espaçamento e retries limitados para leitura; respeita Retry-After e não repete automaticamente sends. O cliente wallet também rejeita cluster divergente. Permanecem as regressões de fila cheia, timeout, 429, liberação da fila, cancelamento e erro distinto de saldo zero.

Na [sessão pública automatizada](evidence/public-browser.json), todos os HTTP RPC observados foram 200, sem escrita Solana ou chamada Mainnet. Isso é uma amostra, não um SLA nem teste de carga. A infraestrutura gratuita continua sujeita a 429; não foram contratados RPCs nem colocados tokens em URLs públicas. As falhas históricas de RPC permanecem documentadas nas etapas anteriores.
