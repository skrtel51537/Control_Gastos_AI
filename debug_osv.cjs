const https = require('https');

function check(version) {
    const data = JSON.stringify({
        package: {
            name: 'lodash',
            ecosystem: 'npm'
        },
        version: '4.17.15'
    });

    const options = {
        hostname: 'api.osv.dev',
        port: 443,
        path: '/v1/query',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (d) => process.stdout.write(d));
    });

    req.on('error', (error) => {
        console.error(error);
    });

    req.write(data);
    req.end();
}

console.log("Checking lodash 4.17.15...");
check('4.17.15');
