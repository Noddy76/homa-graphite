FROM node:7.8.0-alpine

RUN mkdir /app
WORKDIR /app
COPY package.json /app
RUN npm install && npm cache clean

COPY logger.js /app
COPY homa-graphite.js /app

ENTRYPOINT [ "node", "--max-old-space-size=4", "homa-graphite.js" ]
