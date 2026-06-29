FROM node:22-alpine

WORKDIR /app
RUN apk add --no-cache git maven openjdk21-jdk

COPY package.json ./
COPY bin ./bin
COPY src ./src
COPY test ./test
COPY packs ./packs
COPY schemas ./schemas

RUN npm link

WORKDIR /workspace
ENTRYPOINT ["emp"]
