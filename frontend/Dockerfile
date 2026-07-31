FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
RUN adduser -D -u 1001 appuser
COPY --from=build /app/dist /usr/share/nginx/html
COPY ../nginx/default.conf /etc/nginx/conf.d/default.conf
RUN chown -R appuser:appuser /usr/share/nginx/html /var/cache/nginx /var/run
USER appuser
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
