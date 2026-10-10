# Foundry / Base Deployment

Deploying the Soverity contracts to Base (testnet or mainnet).

## Prerequisites

- Foundry (`forge`, `cast`). Repo-local binaries: run `forge` from
  `.downloads/foundry/` or install from <https://getfoundry.sh>.
- A deployer EOA funded with ETH on Base.

## Environment variables

```bash
export BASE_RPC_URL="https://sepolia.base.org"       # Base Sepolia; use https://mainnet.base.org for mainnet
export DEPLOYER_KEY="0x<your-private-key>"           # funded deployer EOA
export ETHERSCAN_API_KEY="<basescan-api-key>"        # only needed for --verify
```

## Deploy (Base Sepolia)

```bash
cd packages/contracts
forge script script/Deploy.s.sol \
  --rpc-url "$BASE_RPC_URL" \
  --private-key "$DEPLOYER_KEY" \
  --broadcast
```

With contract verification (Basescan):

```bash
forge script script/Deploy.s.sol \
  --rpc-url "$BASE_RPC_URL" \
  --private-key "$DEPLOYER_KEY" \
  --broadcast --verify \
  --verifier basescan \
  --verifier-url "https://api-sepolia.basescan.org/api"
```

Deployed addresses are written by forge to
`packages/contracts/broadcast/Deploy.s.sol/<chainId>/run-*.json` and logged
to the console at the end of the run.

## GitHub Actions

The same command runs unattended in CI:

```yaml
- name: Deploy contracts to Base
  run: |
    forge script script/Deploy.s.sol \
      --rpc-url "$BASE_RPC_URL" \
      --private-key "$DEPLOYER_KEY" \
      --broadcast --verify
  working-directory: packages/contracts
  env:
    BASE_RPC_URL: ${{ secrets.BASE_RPC_URL }}
    DEPLOYER_KEY: ${{ secrets.DEPLOYER_KEY }}
    ETHERSCAN_API_KEY: ${{ secrets.ETHERSCAN_API_KEY }}
```

## Post-deployment checklist

1. Rotate the recovery guardian set (`addGuardian` × N → `removeGuardian`
   deployer) to reach the intended M-of-N, e.g. 3-of-5.
2. Transfer `SoverityRegistry` ownership to the `SoverityRecovery` module so
   executed recoveries reassign pass ownership on-chain.
3. Grant the badge issuer role to the operational minter via
   `SoverityBadges.setIssuer(minter, true)` and revoke the deployer's role.
