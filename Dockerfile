FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 7860

ENV PORT=7860

CMD ["node", "dist/dashboard-server.js"]
