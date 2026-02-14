FROM node:20-bookworm

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/frontend/package.json apps/frontend/package.json

RUN npm install -w apps/frontend

COPY apps/frontend apps/frontend

EXPOSE 3000

CMD ["npm", "run", "dev", "-w", "apps/frontend", "--", "--webpack", "--hostname", "0.0.0.0", "--port", "3000"]
