const { spawn } = require('child_process');

const server = spawn('node', ['dist/index.js']);

server.stdout.on('data', (data) => {
  console.log(`STDOUT: ${data}`);
});

server.stderr.on('data', (data) => {
  console.error(`STDERR: ${data}`);
});

server.on('close', (code) => {
  console.log(`Child process exited with code ${code}`);
});

// Wait a bit for the server to start, then send a JSON-RPC request
setTimeout(() => {
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'get_vendor_details',
      arguments: {}
    }
  };
  console.log('Sending request...');
  server.stdin.write(JSON.stringify(request) + '\n');
}, 1000);
