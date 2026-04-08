FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p uploads/scans uploads/images

EXPOSE 3001

CMD ["node", "src/server.js"]
