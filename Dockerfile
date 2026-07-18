# Gizli Uykucu sunucu — Coolify / herhangi bir Docker host.
# Node + ws; framework yok. tsx ile TS'i doğrudan çalıştırır (build adımı yok).
FROM node:22-slim
WORKDIR /app

# Bağımlılıklar (tsx dahil — çalıştırmak için gerekli, o yüzden dev'leri de kur).
COPY package.json package-lock.json* ./
RUN npm ci

# Kaynak + statik istemci.
COPY . .

# Coolify PORT'u enjekte eder; yoksa 3000.
ENV PORT=3000
EXPOSE 3000

# Sunucu 0.0.0.0:PORT dinler, statik dosyaları (public/) ve ws'i aynı portta servis eder.
CMD ["npm", "start"]
