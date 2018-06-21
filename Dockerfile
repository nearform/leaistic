FROM node:8-alpine

# Tell node we are running in prod
ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV
ENV HOST 0.0.0.0

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN yarn install --production=false --silent

# Bundle app source
COPY . .

# Expose the port the app listens on
EXPOSE 3000

# Start the application
CMD [ "npm", "start" ]
