# Operations runbook

## Host baseline

- Ubuntu 24.04 x86_64; one Linux account and SSH public key per teammate.
- Public ingress is limited to 22, 80, and 443; database and API ports remain on the Compose network.
- /home/ubuntu/AgentGuard is the Project Lead development clone.
- /srv/agentguard is a clean deployment checkout of reviewed main only.
- Secrets live in /srv/agentguard/.env with mode 600; they never enter Git, chat, screenshots, or frontend variables.

OS patching, OCI firewall rules, DNS, spending alerts, teammate SSH keys, and GitHub collaborator invitations require account-owner action and are not performed by repository code.

## Initial deployment

    sudo install -d -o ubuntu -g ubuntu -m 750 /srv/agentguard
    git clone YOUR_PRIVATE_REPOSITORY_URL /srv/agentguard
    cd /srv/agentguard
    cp .env.example .env
    chmod 600 .env

Set `DOMAIN=agentguard.my.id`, `AGENT_ALLOWED_ORIGINS=https://agentguard.my.id`, `BOTCHAIN_ALLOCATION_WALLET=0x1905B29C6F01eDe290010DB081A6ad0Ba78A1a91`, the deployed testnet contract address, and the server-side OpenAI key. For deployment only, set `DEPLOYER_PRIVATE_KEY` and `CONTRACT_OWNER_ADDRESS` in `blockchain/.env`, run the testnet deploy command, then remove the private key. Keep testnet chain 968 until the release gate explicitly approves mainnet.

    docker compose config
    docker compose up -d --build
    docker compose ps
    ./infrastructure/scripts/smoke-test.sh "https://YOUR_DOMAIN"

`HTTP_PORT` and `HTTPS_PORT` default to 80 and 443. Override them only for local
validation, for example `HTTP_PORT=8080 HTTPS_PORT=8443`.

## Release and rollback

1. Tag the tested commit and run infrastructure/scripts/backup.sh.
2. Deploy with infrastructure/scripts/deploy.sh; it refuses dirty or non-deployment checkouts.
3. Verify HTTPS, CORS, wallet network, contract address, RPC, explorer links, ALLOW, BLOCK, and manual fallback.
4. To roll back application code, switch /srv/agentguard to the previous release tag and rebuild.
5. Never mutate a defective contract in place. Pause it, deploy a corrected contract, update both backend and frontend addresses, and repeat every test.

## Routine checks

    docker compose ps
    docker compose logs --tail=100
    curl -fsS "https://YOUR_DOMAIN/api/health"
    df -h

Monitor OCI credits, CPU, memory, disk, container restarts, API and AI latency, database errors, and RPC errors. Back up before every production change and before resizing or terminating the VM.
