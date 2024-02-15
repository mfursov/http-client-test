import {httpClientPost, HttpPostInput} from './http-client';

const isFetch = true;

function getInputTemplate(): HttpPostInput {
    return {
        url: "http://localhost:3000",
        isFetch,
        filesFieldName: '',
        files: [],
        message: '',
        headers: {}
    }
}

describe('HTTP client', () => {
    let input: HttpPostInput;
    describe("application/json", () => {
        const fn = httpClientPost;
        beforeEach(() => {
            input = {...getInputTemplate()};
        })

        it("application/json", async () => {
            input.message = "test message";
            expect(await fn(input)).toEqual({
                "body": "\"test message\"",
                "headers": {
                    "accept": "application/json, text/plain, */*",
                    "accept-encoding": "gzip, compress, deflate, br",
                    "connection": "close",
                    "content-length": "14",
                    "content-type": "application/json",
                    "host": "localhost:3000",
                    "user-agent": "axios/1.6.7"
                }
            });
        });
    });
});
