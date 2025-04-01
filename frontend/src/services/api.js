import axios from 'axios';

// Get the backend URL - in development, we use the proxy in package.json
// In production or when running in Docker, we use the container name
let backendUrl = '';
if (process.env.NODE_ENV === 'production') {
  backendUrl = 'http://backend:5000';
} else {
  // In development, we can use the proxy in package.json
  backendUrl = '';
}

// For direct connection to bypass proxy during development
// This helps resolve Gateway Timeout issues with subnet scanning
const directBackendUrl = process.env.NODE_ENV === 'production' 
  ? 'http://backend:5000' 
  : 'http://localhost:5000';

console.log('Using backend URL:', backendUrl || 'proxy');
console.log('Direct backend URL for scan operations:', directBackendUrl);

// Create an Axios instance with a base URL
const api = axios.create({
  baseURL: backendUrl,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 45000 // 45 seconds timeout - increased for subnet scanning
});

// Special API instance with longer timeout for scanning
export const scannerApi = axios.create({
  baseURL: backendUrl,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 90000, // 90 seconds timeout for scanner operations
});

// Direct API instance that bypasses the proxy for scanner operations
export const directScannerApi = axios.create({
  baseURL: directBackendUrl,
  headers: {
    'Content-Type': 'application/json',
    'X-Direct-Connection': 'true'
  },
  timeout: 90000 // 90 seconds timeout for scanner operations
});

// Add interceptors to handle errors
directScannerApi.interceptors.request.use(
  (config) => {
    console.log(`Making DIRECT ${config.method.toUpperCase()} scanner request to ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

directScannerApi.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('Direct scanner error:', error);
    
    // If there's a CORS error or network error, fallback to proxy
    if (error.message === 'Network Error') {
      console.log('CORS or Network Error detected, falling back to proxy...');
      
      // Extract request info from the failed request
      const { method, url, data, params } = error.config;
      const proxyUrl = url.replace(directBackendUrl, '');
      
      // Return a promise that retries with the proxy
      return scannerApi({
        method,
        url: proxyUrl,
        data,
        params
      }).catch(proxyError => {
        console.error('Proxy fallback also failed:', proxyError);
        return Promise.reject(proxyError);
      });
    }
    
    return Promise.reject(error);
  }
);

// Add a request interceptor for authentication tokens if needed later
api.interceptors.request.use(
  (config) => {
    // You can add auth tokens here in the future
    console.log(`Making ${config.method.toUpperCase()} request to ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add the same interceptor to scanner API with special handling for scanning operations
scannerApi.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method.toUpperCase()} scanner request to ${config.url}`);
    // Add special headers for scanner requests
    if (config.url.includes('/scanner/')) {
      config.headers['X-Scanner-Request'] = 'true';
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle network errors
    if (error.message === 'Network Error') {
      console.error('Network error - check backend connection');
    }
    
    // Handle server errors
    if (error.response) {
      console.error(`Server error: ${error.response.status} - ${error.response.statusText}`);
    }
    
    return Promise.reject(error);
  }
);

// Same interceptor for scanner API with better error handling
scannerApi.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.message === 'Network Error') {
      console.error('Network error in scanner - check backend connection');
    } else if (error.code === 'ECONNABORTED') {
      console.error('Scanner request timed out - this is expected for large subnets');
      // For timeout errors during scanning, return a formatted error object
      return Promise.reject({
        response: {
          status: 504,
          data: {
            status: 'error',
            error: 'Scan timeout',
            message: 'The scan operation timed out. Try scanning a smaller subnet or specific IP.',
            isTimeout: true
          }
        }
      });
    } else if (error.response) {
      console.error(`Scanner server error: ${error.response.status} - ${error.response.statusText}`);
    }
    
    return Promise.reject(error);
  }
);

export default api; 