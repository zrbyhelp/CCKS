FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:22-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM deps AS prod-deps

WORKDIR /app

COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm prune --omit=dev
RUN ./node_modules/.bin/prisma generate

FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache git openssh-client

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY README.md ./README.md

EXPOSE 3000

CMD ["sh", "-c", "./node_modules/.bin/prisma db push && node server.js"]
