const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Determine the API URL based on the environment
  const apiUrl = process.env.NODE_ENV === 'production' 
    ? 'http://backend:5000' 
    : 'http://localhost:5000';
  
  console.log('Setting up proxy to:', apiUrl);
  
  /**
   * Create a proxy specifically for the scanner job endpoints 
   * to ensure minimal overhead and maximum reliability
   */
  app.use(
    '/api/scanner/scan',
    createProxyMiddleware({
      target: apiUrl,
      changeOrigin: true,
      pathRewrite: path => path, // Pass path through unchanged
      proxyTimeout: 30000, // 30 seconds should be plenty for job creation
      timeout: 30000,
      onProxyReq: (proxyReq, req, res) => {
        // Add a custom header to identify this as a scanner request
        proxyReq.setHeader('X-Scanner-Request', 'true');
        console.log(`Proxying DIRECT ${req.method} scanner request to ${req.url}`);
      },
      onProxyRes: (proxyRes, req, res) => {
        // Add CORS headers to all responses
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        console.log(`Received DIRECT scanner response from ${req.url} with status ${proxyRes.statusCode}`);
      },
      onError: (err, req, res) => {
        console.error('DIRECT scanner proxy error:', err);
        if (!res.headersSent) {
          res.writeHead(502, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({
            status: 'error',
            error: 'Scanner proxy error',
            message: err.message || 'Failed to connect to backend service',
            code: err.code,
            timestamp: new Date().toISOString()
          }));
        }
      }
    })
  );
  
  // Special proxy for scanner routes with longer timeouts
  app.use(
    '/api/scanner',
    createProxyMiddleware({
      target: apiUrl,
      changeOrigin: true,
      pathRewrite: {
        '^/api': '/api'
      },
      proxyTimeout: 90000, // 90 seconds for proxy timeout
      timeout: 90000,      // 90 seconds for connection timeout
      onProxyReq: (proxyReq, req, res) => {
        console.log(`Proxying SCANNER ${req.method} request to ${req.path}`);
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log(`Received SCANNER response from ${req.path} with status ${proxyRes.statusCode}`);
      },
      onError: (err, req, res) => {
        console.error('Scanner proxy error:', err);
        // Send a structured JSON response on proxy error
        if (!res.headersSent) {
          res.writeHead(502, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          const errorJson = {
            status: 'error',
            error: 'Scanner proxy error',
            message: err.code === 'ECONNRESET' 
              ? 'The scan took too long to process. Try scanning fewer devices or a specific IP.'
              : `${err.message || 'Unknown error'}`,
            code: err.code,
            timestamp: new Date().toISOString()
          };
          res.end(JSON.stringify(errorJson));
        }
      }
    })
  );
  
  // Regular proxy for all other API routes
  app.use(
    '/api',
    createProxyMiddleware({
      target: apiUrl,
      changeOrigin: true,
      pathRewrite: {
        '^/api': '/api'
      },
      proxyTimeout: 30000, // 30 seconds for proxy timeout
      timeout: 30000,      // 30 seconds for connection timeout
      onProxyReq: (proxyReq, req, res) => {
        console.log(`Proxying ${req.method} request to ${req.path}`);
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log(`Received response from ${req.path} with status ${proxyRes.statusCode}`);
      },
      onError: (err, req, res) => {
        console.error('Proxy error:', err);
        // Send a more meaningful response on proxy error
        if (!res.headersSent) {
          res.writeHead(502, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          const errorJson = {
            status: 'error',
            error: 'Proxy error',
            message: err.code === 'ECONNRESET' 
              ? 'The request took too long to process. Try again later.'
              : `${err.message || 'Unknown error'}`,
            code: err.code,
            timestamp: new Date().toISOString()
          };
          res.end(JSON.stringify(errorJson));
        }
      }
    })
  );
}; 