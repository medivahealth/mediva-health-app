const http = require('http');

const data = {
  medications: ['metformin', 'lisinopril', 'warfarin']
};

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/drug-safety/check',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log('Headers:', res.headers);
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('\nFull Response:');
    console.log(body);
    try {
      const parsed = JSON.parse(body);
      console.log('\nParsed JSON:');
      console.log(JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('Could not parse JSON');
    }
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(JSON.stringify(data));
req.end();
