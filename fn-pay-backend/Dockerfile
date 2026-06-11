# Use official Node.js 18 LTS slim image as base
FROM node:18-slim

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json to leverage Docker layer caching
COPY package.json ./

# Install only production dependencies for optimal image size
RUN npm install --only=production

# Copy server.js source file
COPY server.js ./

# Expose port 7860 as required for Hugging Face Spaces
EXPOSE 7860

# Define default environment variables
ENV PORT=7860
ENV NODE_ENV=production

# Start the application
CMD [ "node", "server.js" ]
