# Use Node.js LTS with Alpine for a smaller footprint
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
# Copy package.json and package-lock.json
COPY package*.json ./

# Install production dependencies only
RUN npm install --only=production --no-audit --no-fund

# Copy app source
COPY . .

# Set environment variables
ENV NODE_ENV=production

# Expose the API port
EXPOSE 5000

# Run as non-root user for better security
USER node

# Start the server
CMD ["node", "src/index.js"] 