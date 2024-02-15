import * as http from 'http';

const echoServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString(); // convert Buffer to string
    });
    req.on('end', () => {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.write(JSON.stringify({
            headers: req.headers,
            body,
        }));
        res.end();
    });
});

const port = 3000;
echoServer.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
