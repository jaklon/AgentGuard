FROM node:24.15.0-alpine AS frontend-build

WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./

ARG VITE_API_BASE_URL=/api
ARG VITE_BOTCHAIN_RPC_URL=https://rpc.bohr.life
ARG VITE_BOTCHAIN_CHAIN_ID=968
ARG VITE_BOTCHAIN_EXPLORER_URL=https://scan.bohr.life
ARG VITE_BOTCHAIN_CONTRACT_ADDRESS
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_BOTCHAIN_RPC_URL=$VITE_BOTCHAIN_RPC_URL \
    VITE_BOTCHAIN_CHAIN_ID=$VITE_BOTCHAIN_CHAIN_ID \
    VITE_BOTCHAIN_EXPLORER_URL=$VITE_BOTCHAIN_EXPLORER_URL \
    VITE_BOTCHAIN_CONTRACT_ADDRESS=$VITE_BOTCHAIN_CONTRACT_ADDRESS

RUN npm run build

FROM caddy:2.10.2-alpine
COPY infrastructure/Caddyfile /etc/caddy/Caddyfile
COPY --from=frontend-build /src/dist /srv
