FROM node:20-bookworm

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json

RUN npm install -w apps/backend

COPY apps/backend apps/backend

EXPOSE 3001

CMD ["npm", "run", "dev", "-w", "apps/backend"]
