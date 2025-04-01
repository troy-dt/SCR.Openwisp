# PowerShell script to run SCR-Mesh in production mode

# Configuration variables - change these as needed
$REGISTRY = "docker.io"
$NAMESPACE = "d1g1talterrain"
$TAG = "latest"
$DB_PASSWORD = "secure-password"  # Change this to a secure password

# Create .env file with configuration
@"
REGISTRY=$REGISTRY
NAMESPACE=$NAMESPACE
TAG=$TAG
DB_PASSWORD=$DB_PASSWORD
"@ | Out-File -FilePath .env -Encoding utf8 -Force

Write-Host "Created .env file with configuration" -ForegroundColor Cyan
Write-Host "Starting SCR-Mesh in production mode..." -ForegroundColor Cyan

# Run docker-compose with production config
docker-compose -f docker-compose.prod.yml up -d

Write-Host "SCR-Mesh is now running in production mode!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "Backend API: http://localhost:5000" -ForegroundColor Green
Write-Host ""
Write-Host "To view logs:" -ForegroundColor Yellow
Write-Host "  docker-compose -f docker-compose.prod.yml logs -f" -ForegroundColor Yellow
Write-Host ""
Write-Host "To stop:" -ForegroundColor Yellow
Write-Host "  docker-compose -f docker-compose.prod.yml down" -ForegroundColor Yellow 