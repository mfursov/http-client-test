import {HttpPostInput, HttpResponse, rawSquidHttpPost as httpClientPost, RpcError} from './http-client';
import {REQUEST_BODY_TEXT_TO_TRIGGER_ERROR_RESPONSE, RESPONSE_ERROR_TEXT} from './common';

const isFetch = true;

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

async function postBody(input: HttpPostInput): Promise<string> {
    const response = await post(input);
    return (response.body as EchoServiceResponse).body as string;
}

describe('HTTP client', () => {
    let input: HttpPostInput;
    describe("application/json", () => {
        beforeEach(() => {
            input = {...getInputTemplate()};
        })

        it("string", async () => {
            input.message = "test message";
            expect(await postBody(input)).toEqual('"test message"')
        });

        it("object", async () => {
            input.message = {'message': 'test message'};
            expect(await postBody(input)).toEqual("{\"message\":\"test message\"}")
        });

        it("number", async () => {
            input.message = 1;
            expect(await postBody(input)).toEqual("1")
        });

        it("boolean", async () => {
            input.message = true;
            expect(await postBody(input)).toEqual("true")
        });

        it("array", async () => {
            input.message = [1, 2, 3];
            expect(await postBody(input)).toEqual("[1,2,3]")
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
});
