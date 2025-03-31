# OpenWrt Router Monitor

A Docker-based application for monitoring OpenWrt routers and displaying metrics in a React dashboard.

## Features

- Monitor multiple OpenWrt routers via SSH
- Collect and display metrics:
  - Uptime
  - CPU load
  - Memory usage
  - Disk usage
  - Network interfaces
  - Wireless clients
- Real-time status monitoring
- Scheduled metrics collection
- Responsive dashboard

## Architecture

The application consists of three main components:

1. **React Frontend**: UI for displaying router metrics and managing routers
2. **Node.js Backend**: API for collecting and serving router data
3. **MongoDB Database**: Persistent storage for router configurations and metrics

## Prerequisites

- Docker and Docker Compose
- OpenWrt routers with SSH access

## Getting Started

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/openwisp-router-monitor.git
   cd openwisp-router-monitor
   ```

2. Start the application using Docker Compose:
   ```
   docker-compose up -d
   ```

3. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## Usage

1. Add a router by providing:
   - Name
   - Hostname/IP Address
   - SSH credentials

2. View metrics on the dashboard
3. Monitor router status
4. Configure collection intervals

## Development

### Backend

The backend is built with Node.js, Express, and MongoDB:

```
cd backend
npm install
npm run dev
```

### Frontend

The frontend is built with React and Material UI:

```
cd frontend
npm install
npm start
```

## License

MIT 