import axios, {AxiosResponse, isAxiosError} from 'axios';

class DebugLogger {
    static debug(v: string): void {
        if (Date.now() < 0) { // Disabled
            console.log(v);
        }
    }
}

export interface BlobAndFilename {
    blob: Blob;
    name: string;
}

export function serializeObj(obj: unknown): string | null {
    if (obj === undefined) return null;
    return JSON.stringify(obj);
}

function tryDeserializing<T>(text: string | undefined): T | string | undefined {
    if (!text) return undefined;
    return JSON.parse(text);
}

export class RpcError<BodyType = unknown> extends Error {
    /** @internal */
    constructor(
        readonly statusCode: number,
        readonly statusText: string,
        readonly url: string,
        readonly headers: Record<string, string>,
        readonly body: BodyType,
        message?: string,
    ) {
        super(message || `RPC error ${statusCode} ${statusText} calling ${url}`);
    }
}

export interface HttpPostInput<RequestBodyType = unknown> {
    url: string;
    headers: Record<string, string>;
    message: RequestBodyType;
    files: Array<File | BlobAndFilename>;
    filesFieldName: string;
    extractErrorMessage: boolean;
    isFetch: boolean;
}

/** A response object with type T for the body. */
export interface HttpResponse<BodyType = unknown> {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: BodyType;
}

/**
 * Runs a post request to the given URL.
 * @internal.
 */
export async function rawSquidHttpPost<ResponseType = unknown, RequestType = unknown>(
    input: HttpPostInput<RequestType>,
): Promise<HttpResponse<ResponseType>> {
    // Native fetch is used in json request mode or when the corresponding private Squid option is enabled.
    // This option is enabled in console-local and console-dev modes both in Web & Backend.
    const response = await (input.isFetch ? performFetchRequest(input) : await performAxiosRequest(input));
    response.body = tryDeserializing<ResponseType>(response.body as string);
    return response as HttpResponse<ResponseType>;
}

async function performFetchRequest({
                                       headers,
                                       files,
                                       filesFieldName,
                                       message: body,
                                       url,
                                       extractErrorMessage,
                                   }: HttpPostInput): Promise<HttpResponse> {
    const requestOptionHeaders = new Headers(headers);
    const requestOptions: RequestInit = {method: 'POST', headers: requestOptionHeaders, body: undefined};
    if (files.length) {
        const formData = new FormData();
        for (const file of files) {
            const blob = file instanceof Blob ? file : (file as BlobAndFilename).blob;
            const filename = file instanceof Blob ? undefined : (file as BlobAndFilename).name;
            formData.append(filesFieldName, blob, filename);
        }
        formData.append('body', serializeObj(body));
        requestOptions.body = formData;
    } else {
        requestOptionHeaders.append('Content-Type', 'application/json');
        requestOptions.body = serializeObj(body);
    }
    const response = await fetch(url, requestOptions);
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
    });
    if (!response.ok) {
        const rawBody = await response.text();
        const parsedBody: any = tryDeserializing(rawBody);

        if (!extractErrorMessage) {
            throw new RpcError(response.status, response.statusText, url, responseHeaders, parsedBody, rawBody);
        }

        let message;
        try {
            message = typeof parsedBody === 'string' ? parsedBody : parsedBody['message'] || rawBody;
        } catch {}
        if (!message) message = response.statusText;
        throw new RpcError(response.status, response.statusText, url, responseHeaders, parsedBody, message);
    }

    const responseBody = await response.text();
    DebugLogger.debug(`received response: ${JSON.stringify(responseBody)}`);
    return {
        body: responseBody,
        headers: responseHeaders,
        status: response.status,
        statusText: response.statusText,
    };
}

function extractAxiosResponseHeaders(response: AxiosResponse): Record<string, string> {
    return Object.entries(response.headers).reduce(
        (acc, [key, value]) => {
            acc[key] = value;
            return acc;
        },
        {} as Record<string, string>,
    );
}

async function performAxiosRequest({
                                       files,
                                       filesFieldName,
                                       message: body,
                                       url,
                                       headers,
                                       extractErrorMessage,
                                   }: HttpPostInput): Promise<HttpResponse> {
    let axiosResponse;
    try {
        if (files.length) {
            const formData = new FormData();
            for (const file of files) {
                const blob = file instanceof Blob ? file : (file as BlobAndFilename).blob;
                const filename = file instanceof Blob ? undefined : (file as BlobAndFilename).name;
                formData.append(filesFieldName, blob, filename);
            }

            formData.append('body', serializeObj(body));
            // Make the axios call
            axiosResponse = await axios.post(url, formData, {
                headers,
                responseType: 'text',
            });
        } else {
            axiosResponse = await axios.post(url, serializeObj(body), {
                headers: {
                    ...headers,
                    'Content-Type': 'application/json',
                },
                responseType: 'text',
            });
        }
    } catch (error) {
        if (isAxiosError(error)) {
            const {response} = error;
            if (!response) throw error;
            const responseHeaders = extractAxiosResponseHeaders(response);
            const rawBody = response.data as string;
            const parsedBody: any = tryDeserializing(rawBody);
            if (!extractErrorMessage) {
                throw new RpcError(response.status, response.statusText, url, responseHeaders, parsedBody, rawBody);
            }

            let message;
            try {
                message = typeof parsedBody === 'string' ? parsedBody : parsedBody['message'] || rawBody;
            } catch {}
            if (!message) message = response.statusText;
            throw new RpcError(response.status, response.statusText, url, responseHeaders, parsedBody, message);
        } else {
            throw error;
        }
    }

    const responseHeaders = extractAxiosResponseHeaders(axiosResponse);
    DebugLogger.debug(`received response: ${JSON.stringify(axiosResponse.data)}`);
    return {
        body: axiosResponse.data,
        headers: responseHeaders,
        status: axiosResponse.status,
        statusText: axiosResponse.statusText,
    };
}