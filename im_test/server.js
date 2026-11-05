const path = require('path');
const fs = require('fs');
console.log('Copying prebid.js to public directory...');
fs.copyFileSync(
  path.resolve(__dirname + '/../build/dev/prebid.js'),
  path.resolve(__dirname + '/public/prebid.js')
);
console.log('Copying prebid.js done!');

console.log('Setting up static file server...');
const express = require('express');
const app = express();
app.use(express.static(__dirname + '/public'));
app.listen(3000);
console.log('Static file server is running on http://localhost:3000');
