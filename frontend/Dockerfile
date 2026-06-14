FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependency structures
COPY package.json package-lock.json* ./
RUN npm ci

# Copy project files
COPY . .

# Compile application
RUN npm run build

FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built assets
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "run", "start"]
