FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY services/ask/granite.ts services/ask/local-profile.ts services/ask/ollama.ts services/ask/selection.ts services/ask/server.ts ./services/ask/
COPY src/lib/ask/catalog.ts src/lib/ask/history.ts src/lib/ask/local-pets.ts src/lib/ask/reviewed-questions.ts src/lib/ask/version.ts ./src/lib/ask/
COPY src/data/ask/facts.json ./src/data/ask/
USER node
CMD ["node", "services/ask/server.ts", "--container"]
