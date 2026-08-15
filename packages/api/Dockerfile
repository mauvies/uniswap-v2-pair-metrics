FROM node:24-alpine

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/

RUN pnpm install --frozen-lockfile --prod --filter @uniswap-v2-pair-metrics/api...

COPY packages/shared packages/shared
COPY packages/api packages/api

USER node
WORKDIR /app/packages/api

CMD ["node", "src/main.ts"]
