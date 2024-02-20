import {
    BlobAndFilename,
    HttpPostInput,
    HttpResponse,
    rawSquidHttpPost as httpClientPost,
    RpcError
} from './http-client';
import {REQUEST_BODY_TEXT_TO_TRIGGER_ERROR_RESPONSE, RESPONSE_ERROR_TEXT} from './common';

const isFetch = false;

function getInputTemplate(): HttpPostInput {
    return {
        url: "http://localhost:23000",
        isFetch,
        filesFieldName: '',
        files: [],
        message: '',
        headers: {},
        extractErrorMessage: false,
    }
}

/**
 * Body of the echo response contains a serialized json {body:{}, headers: {}} of the request.
 * See echo server impl.
 */
interface EchoServiceResponse {
    /** Raw body string. */
    body: string;
    /** Request headers. */
    headers: Record<string, string>;
}

async function post(input: HttpPostInput): Promise<HttpResponse> {
    return await httpClientPost(input);
}

async function postAndReturnRequestBody(input: HttpPostInput): Promise<string> {
    const response = await post(input);
    return (response.body as EchoServiceResponse).body as string;
}

const UNIFIED_MULTIPART_BOUNDARY = '--boundary-';

async function postAndReturnUnifiedRequestBody(input: HttpPostInput): Promise<string> {
    const body = await postAndReturnRequestBody(input);
    let unifiedBody = '';
    const lines = body.split("\n");
    for (const line of lines) {
        if (unifiedBody.length > 0) {
            unifiedBody += '\n';
        }
        unifiedBody += line.startsWith('--axios-1.6.7-boundary-') || line.startsWith('------formdata-undici-')
            ? UNIFIED_MULTIPART_BOUNDARY
            : line;
    }
    return unifiedBody.trim();
}

describe('HTTP client', () => {
    let input: HttpPostInput;

    beforeEach(() => {
        input = {...getInputTemplate()};
    })

    describe("application/json", () => {

        it("string", async () => {
            input.message = "test message";
            expect(await postAndReturnRequestBody(input)).toEqual('"test message"')
        });

        it("object", async () => {
            input.message = {'message': 'test message'};
            expect(await postAndReturnRequestBody(input)).toEqual("{\"message\":\"test message\"}")
        });

        it("number", async () => {
            input.message = 1;
            expect(await postAndReturnRequestBody(input)).toEqual("1")
        });

        it("boolean", async () => {
            input.message = true;
            expect(await postAndReturnRequestBody(input)).toEqual("true")
        });

        it("array", async () => {
            input.message = [1, 2, 3];
            expect(await postAndReturnRequestBody(input)).toEqual("[1,2,3]")
        });

        it("error response", async () => {
            input.message = REQUEST_BODY_TEXT_TO_TRIGGER_ERROR_RESPONSE;
            let error: unknown;
            try {
                await post(input);
            } catch (e) {
                error = e
            }
            expect(error).toBeDefined();
            expect((error instanceof RpcError)).toBe(true);
            expect((error as RpcError).statusCode).toBe(400);
            expect((error as RpcError).message).toBe(`{"message":"${RESPONSE_ERROR_TEXT}"}`);
        });
    });

    describe("files and blobs", () => {
        it('single blob', async () => {
            const fileData = 'this text will be encoded as unicode';
            const buffer = new Buffer(fileData, 'utf16le');
            const blob: BlobAndFilename = {blob: new Blob([buffer]), name: 'blobName'};
            input.files = [blob];
            input.filesFieldName = 'filesFieldName';
            const body = await postAndReturnUnifiedRequestBody(input);
            const expectedBody =
                `${UNIFIED_MULTIPART_BOUNDARY}\n` +
                'Content-Disposition: form-data; name="filesFieldName"; filename="blobName"\r\n' +
                'Content-Type: application/octet-stream\r\n' +
                '\r\n' +
                fileData.split('').map(c => `${c}\0`).join('') + '\r\n' +
                `${UNIFIED_MULTIPART_BOUNDARY}\n` +
                'Content-Disposition: form-data; name="body"\r\n' +
                '\r\n' +
                '""\r\n' +
                `${UNIFIED_MULTIPART_BOUNDARY}`;
            expectEqualStringWithBinaryCharacters(body, expectedBody);
        })

        it('multiple blobs', async () => {
            const fileData1 = 'this text will be encoded as unicode 1';
            const buffer1 = new Buffer(fileData1, 'utf16le');
            const blob1: BlobAndFilename = {blob: new Blob([buffer1]), name: 'blobName1'};
            const fileData2 = 'this text will be encoded as unicode 2';
            const buffer2 = new Buffer(fileData2, 'utf16le');
            const blob2: BlobAndFilename = {blob: new Blob([buffer2]), name: 'blobName2'};
            input.files = [blob1, blob2];
            input.filesFieldName = 'filesFieldName';
            const body = await postAndReturnUnifiedRequestBody(input);
            const expectedBody =
                `${UNIFIED_MULTIPART_BOUNDARY}\n` +
                'Content-Disposition: form-data; name="filesFieldName"; filename="blobName1"\r\n' +
                'Content-Type: application/octet-stream\r\n' +
                '\r\n' +
                fileData1.split('').map(c => `${c}\0`).join('') + '\r\n' +
                `${UNIFIED_MULTIPART_BOUNDARY}\n` +
                'Content-Disposition: form-data; name="filesFieldName"; filename="blobName2"\r\n' +
                'Content-Type: application/octet-stream\r\n' +
                '\r\n' +
                fileData2.split('').map(c => `${c}\0`).join('') + '\r\n' +
                `${UNIFIED_MULTIPART_BOUNDARY}\n` +
                'Content-Disposition: form-data; name="body"\r\n' +
                '\r\n' +
                '""\r\n' +
                `${UNIFIED_MULTIPART_BOUNDARY}`;
            expectEqualStringWithBinaryCharacters(body, expectedBody);

        })
    });

});


function expectEqualStringWithBinaryCharacters(received: string, expected: string): void {
    // Protect against invalid characters.
    const receivedEncoded = encodeURIComponent(received);
    const expectedEncoded = encodeURIComponent(expected);
    expect(receivedEncoded).toBe(expectedEncoded);
}