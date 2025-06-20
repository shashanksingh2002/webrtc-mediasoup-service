# Use official Bun image
FROM oven/bun:1.1.0

# Set working directory
WORKDIR /app

# Copy files
COPY . .

# Install dependencies
RUN bun install

# Expose the signaling port
EXPOSE 3001

# Health check endpoint is already in the app
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl --fail http://localhost:3001/health || exit 1

# Start the Bun app
CMD ["bun", "index.ts"]

