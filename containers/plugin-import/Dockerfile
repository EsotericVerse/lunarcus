FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY containers/plugin-import/processor.mjs containers/plugin-import/server.mjs ./
USER node
EXPOSE 8080
CMD ["node","server.mjs"]
