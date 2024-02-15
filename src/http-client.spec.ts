import {httpClientPost, HttpPostInput, RpcError} from './http-client';
import {REQUEST_BODY_TEXT_TO_TRIGGER_ERROR_RESPONSE, RESPONSE_ERROR_TEXT} from './common';

const isFetch = false;

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

interface EchoServiceResponse {
    /** Raw body string. */
    body: string;
    /** Request headers. */
    headers: Record<string, string>;
}

async function post(input: HttpPostInput): Promise<EchoServiceResponse> {
    return await httpClientPost<EchoServiceResponse>(input);
}

async function postBody(input: HttpPostInput): Promise<string> {
    const response = await post(input);
    return response.body;
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
            expect((error as RpcError).message).toBe(RESPONSE_ERROR_TEXT);
        });
    });
});
