FROM node:24.15.0-alpine AS build

ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=""
ENV NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:24.15.0-alpine

ENV NODE_ENV=production \
    PORT=5173 \
    HOSTNAME=0.0.0.0

WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 5173
CMD ["node", "server.js"]
