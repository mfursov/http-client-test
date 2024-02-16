import * as http from 'http';
import {REQUEST_BODY_TEXT_TO_TRIGGER_ERROR_RESPONSE, RESPONSE_ERROR_TEXT} from './common';

const echoServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString(); // convert Buffer to string
    });
    req.on('end', () => {
        // Set CORS headers.
        res.setHeader('Access-Control-Allow-Origin', '*'); // Allow all origins
        res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, PUT, PATCH, DELETE'); // Allowed methods
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // Allowed headers

        // Check for preflight request.
        if (req.method === 'OPTIONS') {
            res.writeHead(204); // No content.
            res.end();
            return;
        }
        if (body.includes(REQUEST_BODY_TEXT_TO_TRIGGER_ERROR_RESPONSE)) {
            res.writeHead(400, {'Content-Type': 'application/json'});
            const response = JSON.stringify({message: RESPONSE_ERROR_TEXT});
            res.write(response);
            console.log('Response', response)
            res.end();
        } else {
            // Do just an echo.
            res.writeHead(200, {'Content-Type': 'application/json'});
            const response = JSON.stringify({
                headers: req.headers,
                body,
            });
            res.write(response);
            console.log('Response', response)
            res.end();
        }
    });
});

const port = 23000;
echoServer.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
