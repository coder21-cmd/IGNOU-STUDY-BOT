# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create data directory for SQLite database
RUN mkdir -p data

# Expose port (Railway will set PORT automatically)
EXPOSE $PORT

# Start the application
CMD ["npm", "start"]