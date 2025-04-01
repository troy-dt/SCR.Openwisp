# PowerShell script to build and push SCR-Mesh Docker images

# Set variables
$REGISTRY = "docker.io"  # Change to your Docker registry if needed
$NAMESPACE = "d1g1talterrain"  # Your Docker Hub username or organization
$FRONTEND_IMAGE = "scr-mesh-frontend"
$BACKEND_IMAGE = "scr-mesh-backend"
$VERSION = Get-Date -Format "yyyyMMddHHmm"  # Use timestamp as version
$LATEST = "latest"

# Check if logged in to Docker Hub - try a simple command instead of checking info
#Write-Host "Checking Docker Hub login status..." -ForegroundColor Cyan
#try {
#    # Use a simple command to check if we can access Docker Hub
#    $null = docker manifest inspect $REGISTRY/library/hello-world:latest
#    Write-Host "Docker Hub login confirmed!" -ForegroundColor Green
#} catch {
#    Write-Host "You are not logged in to Docker Hub. Please login first:" -ForegroundColor Yellow
#    Write-Host "docker login" -ForegroundColor Yellow
#    exit 1
#}

Write-Host "Building self-contained SCR-Mesh Docker images..." -ForegroundColor Cyan

# Set environment variables for docker-compose
$env:REGISTRY = $REGISTRY
$env:NAMESPACE = $NAMESPACE
$env:TAG = $VERSION
$env:NODE_ENV = "production"  # Ensure production build

# Build the images using docker-compose with build file
docker-compose -f docker-compose.build.yml build

# Check if build was successful
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Docker build failed. Please fix the issues and try again." -ForegroundColor Red
    exit 1
}

# Push to registry with version and latest tags
Write-Host "Pushing images to registry..." -ForegroundColor Cyan

# Push frontend image
docker push "$REGISTRY/$NAMESPACE/$FRONTEND_IMAGE`:$VERSION"
docker push "$REGISTRY/$NAMESPACE/$FRONTEND_IMAGE`:$LATEST"

# Push backend image
docker push "$REGISTRY/$NAMESPACE/$BACKEND_IMAGE`:$VERSION"
docker push "$REGISTRY/$NAMESPACE/$BACKEND_IMAGE`:$LATEST"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to push images to Docker Hub. Please check your connection and credentials." -ForegroundColor Red
    exit 1
}

# Create/update deployment file example with the version tag
Write-Host "Creating deployment example file..." -ForegroundColor Cyan
@"
# Example deployment file
# Save this as docker-compose.yml on your deployment server

services:
  frontend:
    image: $REGISTRY/$NAMESPACE/$FRONTEND_IMAGE`:$VERSION
    restart: unless-stopped
    ports:
      - "\${FRONTEND_PORT:-80}:80"
    environment:
      - NODE_ENV=production
    depends_on:
      - backend

  backend:
    image: $REGISTRY/$NAMESPACE/$BACKEND_IMAGE`:$VERSION
    restart: unless-stopped
    ports:
      - "\${BACKEND_PORT:-5000}:5000"
    depends_on:
      - postgres
    environment:
      - DATABASE_URL=postgres://postgres:\${POSTGRES_PASSWORD:-postgres}@postgres:5432/openwisp
      - NODE_ENV=production

  postgres:
    image: postgres:14
    restart: unless-stopped
    ports:
      - "\${POSTGRES_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=\${POSTGRES_PASSWORD:-postgres}
      - POSTGRES_USER=postgres
      - POSTGRES_DB=openwisp

volumes:
  postgres_data:
"@ | Out-File -FilePath "deploy-example.yml" -Encoding utf8

Write-Host "Done! Images built and pushed:" -ForegroundColor Green
Write-Host "$REGISTRY/$NAMESPACE/$FRONTEND_IMAGE`:$VERSION" -ForegroundColor Green
Write-Host "$REGISTRY/$NAMESPACE/$FRONTEND_IMAGE`:$LATEST" -ForegroundColor Green
Write-Host "$REGISTRY/$NAMESPACE/$BACKEND_IMAGE`:$VERSION" -ForegroundColor Green
Write-Host "$REGISTRY/$NAMESPACE/$BACKEND_IMAGE`:$LATEST" -ForegroundColor Green
Write-Host ""
Write-Host "To deploy these images, copy docker-compose.prod.yml to your server and run:" -ForegroundColor Cyan
Write-Host "  docker-compose -f docker-compose.prod.yml up -d" -ForegroundColor White
Write-Host ""
Write-Host "Or use the specific version:" -ForegroundColor Cyan
Write-Host "  TAG=$VERSION docker-compose -f docker-compose.prod.yml up -d" -ForegroundColor White 