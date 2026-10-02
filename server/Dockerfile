FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/public ./public
COPY package.json ./
EXPOSE 4000
# 컨테이너 시작 시 마이그레이션 적용 후 서버 실행
CMD ["sh", "-c", "node dist/scripts/migrate.js && node dist/src/server.js"]
