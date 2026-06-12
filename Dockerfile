FROM node:20-alpine

# System dependencies for sqlite + native modules
RUN apk add --no-cache \
    dumb-init \
    python3 \
    make \
    g++ \
    sqlite-dev

WORKDIR /app

# Install dependencies first (cache optimization)
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Create DB directory
RUN mkdir -p /app/data

# IMPORTANT: production mode
ENV NODE_ENV=production

# Build frontend (Vite)
RUN npm run build

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]

# Run production server
CMD ["npm", "start"]