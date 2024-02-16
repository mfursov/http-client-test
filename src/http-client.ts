import axios, {isAxiosError} from 'axios';

export interface BlobAndFilename {
    blob: Blob;
    name: string;
}

export class RpcError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly statusText: string,
        public readonly url: string,
        message?: string,
    ) {
        super(message || `RPC error ${statusCode} ${statusText} calling ${url}`);
    }
}

export interface HttpPostInput {
    url: string;
    headers: Record<string, string>;
    message: unknown;
    files: Array<File | BlobAndFilename>;
    filesFieldName: string;
    isFetch: boolean;
}

/**
 * Runs a post request to the given URL.
 * @internal.
 */
export async function httpClientPost<T>({
                                            url,
                                            headers,
                                            files,
                                            filesFieldName,
                                            message,
                                            isFetch
                                        }: HttpPostInput): Promise<T> {
    if (isFetch) {
        const requestOptionHeaders = new Headers(headers);
        const requestOptions: RequestInit = {method: 'POST', headers: requestOptionHeaders, body: undefined};
        // Axios compat settings start.
        requestOptions.keepalive = false;
        // Axios compat settings end.
        if (files.length) {
            const formData = new FormData();
            for (const file of files) {
                const blob = file instanceof Blob ? file : (file as BlobAndFilename).blob;
                const filename = file instanceof Blob ? undefined : (file as BlobAndFilename).name;
                formData.append(filesFieldName, blob, filename);
            }
            formData.append('body', serializeObj(message));
            requestOptions.body = formData;
        } else {
            requestOptionHeaders.append('Content-Type', 'application/json');
            requestOptions.body = serializeObj(message);
        }
        const response = await fetch(url, requestOptions);
        if (!response.ok) {
            const errorBody = await response.text();
            const errorResponse: any = tryDeserializing(errorBody);
            const errorResponseMessage =
                errorResponse === undefined ? undefined :
                    typeof errorResponse === 'object' && errorResponse !== null
                        ? `${errorResponse['message']}`
                        : `${errorResponse}`;
            throw new RpcError(response.status, response.statusText, url, errorResponseMessage);
        }
        const responseData = await response.text();
        const parsedResponse = tryDeserializing(responseData);
        return parsedResponse as T;
    } else {
        let axiosResponse;
        try {
            if (files.length) {
                const formData = new FormData();
                for (const file of files) {
                    const blob = file instanceof Blob ? file : (file as BlobAndFilename).blob;
                    const filename = file instanceof Blob ? undefined : (file as BlobAndFilename).name;
                    formData.append(filesFieldName, blob, filename);
                }

                formData.append('body', serializeObj(message));
                // Make the axios call
                axiosResponse = await axios.post(url, formData, {
                    headers: {
                        ...headers,
                    },
                    responseType: 'text',
                });
            } else {
                axiosResponse = await axios.post(url, serializeObj(message), {
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json',
                    },
                    responseType: 'text',
                });
            }
        } catch (error) {
            if (isAxiosError<T>(error)) {
                const {response} = error;
                if (!response) throw error;
                let message;
                try {
                    const errorResponse: any = tryDeserializing(response.data as any);
                    message = typeof errorResponse === 'string' ? errorResponse : errorResponse['message'];
                } catch {}
                if (!message) message = response.statusText;
                throw new RpcError(response.status, response.statusText, url, message);
            } else {
                throw error;
            }
        }

        const parsedResponse = tryDeserializing(axiosResponse.data);
        return parsedResponse as T;
    }
}

export function serializeObj(obj: unknown): string | null {
    if (obj === undefined) return null;
    return JSON.stringify(obj);
}

function tryDeserializing<T>(text: string | undefined): T | string | undefined {
    if (!text) return undefined;
    return JSON.parse(text);
}
