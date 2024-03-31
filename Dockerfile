FROM checkmarx.jfrog.io/ast-docker/chainguard/node:latest as build-env

ARG GIT_TOKEN

RUN echo "//npm.pkg.github.com/:_authToken=${GIT_TOKEN}" > ~/.npmrc

WORKDIR /app

COPY --chown=node:node package*.json .

RUN npm install

COPY --chown=node:node . .

RUN npm run vscode:prepublish
RUN npm run compile

