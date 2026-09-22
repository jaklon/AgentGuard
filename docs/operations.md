# Operations runbook

## Host baseline

- Ubuntu 24.04 ARM64 (Oracle Cloud Ampere A1, 4 OCPU, 24 GB RAM); one Linux account and SSH public key per teammate.
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

Set the real domain, exact HTTPS origin, and contract address. Keep testnet chain 968 until the release gate explicitly approves mainnet.

## Local Qwen inference

AgentGuard defaults to an internal CPU-only llama.cpp service. On the 4-OCPU, 24-GB
ARM host, use `Qwen3-4B-Instruct-2507-Q4_K_M.gguf` with a short (4,096-token)
context and three inference threads. The model service is on the Compose network only;
never publish port 8080 to the host or configure it as a public reverse-proxy route.

Download the pinned GGUF before starting Compose. The script verifies the Hugging Face LFS
SHA-256 before installing the file:

    cd /srv/agentguard
    ./infrastructure/scripts/fetch-local-model.sh

Set `AI_PROVIDER=llama_cpp`, `AI_MODEL=Qwen3-4B-Instruct-2507-Q4_K_M.gguf`, and
`LOCAL_LLM_BASE_URL=http://llm:8080` in `.env`. If the local model is unavailable, prompt
evaluation safely falls back to deterministic extraction; `/api/health` reports the AI
component as an error until llama.cpp is ready.

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
