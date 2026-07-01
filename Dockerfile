FROM node:22-alpine

WORKDIR /app
RUN apk add --no-cache git maven openjdk21-jdk

COPY package.json ./
COPY Dockerfile ./
COPY action.yml ./
COPY bin ./bin
COPY src ./src
COPY scripts ./scripts
COPY test ./test
COPY benchmarks ./benchmarks
COPY features ./features
COPY knowledge ./knowledge
COPY packs ./packs
COPY schemas ./schemas
COPY docs ./docs
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN npm link
RUN chmod +x ./docker-entrypoint.sh

WORKDIR /workspace
ENTRYPOINT ["/app/docker-entrypoint.sh"]
