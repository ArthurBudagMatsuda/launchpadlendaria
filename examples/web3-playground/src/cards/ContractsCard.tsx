import { RETRY_NETWORKS, SUPPORTED_CHAIN_IDS } from '@retry/web3'
import { getContractDeployment, RETRY_CONTRACT_NAMES } from '@retry/web3/contracts'

export function ContractsCard() {
  return (
    <section className="pg-card" aria-labelledby="contracts-title" data-testid="contracts-card">
      <h2 id="contracts-title">Contract registry</h2>
      <table className="pg-table">
        <thead>
          <tr>
            <th scope="col">Contract</th>
            {SUPPORTED_CHAIN_IDS.map((id) => (
              <th scope="col" key={id}>
                {RETRY_NETWORKS[id].name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RETRY_CONTRACT_NAMES.map((name) => (
            <tr key={name}>
              <th scope="row">{name}</th>
              {SUPPORTED_CHAIN_IDS.map((id) => {
                const deployment = getContractDeployment(id, name)
                return (
                  <td key={id} className="pg-mono">
                    {deployment.status === 'deployed' ? deployment.address : 'Not deployed'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
