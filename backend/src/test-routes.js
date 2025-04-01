const express = require('express');
const scannerRoutes = require('./routes/scanner.routes');
const app = express();

// Register the scanner routes
app.use('/api/scanner', scannerRoutes);

// Log all registered routes
console.log('Registered Routes:');
const printRoutes = (stack, basePath = '') => {
  stack.forEach(layer => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase()).join(',');
      console.log(`${methods} ${basePath}${layer.route.path}`);
    } else if (layer.name === 'router' && layer.handle.stack) {
      const newBase = basePath + (layer.regexp.toString().indexOf('/api') > -1 ? '/api' : '');
      printRoutes(layer.handle.stack, newBase);
    }
  });
};

printRoutes(app._router.stack);

console.log('\nRouter stack structure:');
app._router.stack.forEach((layer, i) => {
  if (layer.name === 'router') {
    console.log(`Layer ${i}: Router`);
    console.log(`  Path: ${layer.regexp}`);
    console.log(`  Stack length: ${layer.handle.stack.length}`);
    
    layer.handle.stack.forEach((routeLayer, j) => {
      if (routeLayer.route) {
        console.log(`    Route ${j}: ${Object.keys(routeLayer.route.methods).join(',')} ${routeLayer.route.path}`);
      } else {
        console.log(`    Layer ${j}: ${routeLayer.name}`);
      }
    });
  } else {
    console.log(`Layer ${i}: ${layer.name}`);
  }
}); 