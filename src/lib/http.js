/**
 * Shared HTTP client for agents
 * Reduces boilerplate around fetch, error handling, and response parsing
 */

/**
 * Makes a GET request and returns parsed JSON.
 * @param {string} url - The URL to fetch
 * @param {string} agentName - The agent name for error messages (e.g., "Weather", "News")
 * @returns {Promise<any>} Parsed JSON response
 * @throws {Error} If the response is not ok
 */
export async function fetchJson(url, agentName, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.apiKey) {
    headers['X-Brovis-Key'] = options.apiKey;
  }

  const init = { cache: 'no-store', headers };
  if (options.method) init.method = options.method;
  if (options.body !== undefined) {
    init.method = init.method || 'POST';
    init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, init);
  if (!res.ok) {
    // Prefer upstream error message when available (e.g. 401 "API key required")
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) detail = body.error;
    } catch {
      // Response wasn't JSON — keep the status line.
    }
    throw new Error(`${agentName}: ${detail}`);
  }
  return res.json();
}

/**
 * Helper to build query strings
 * @param {Record<string, string | number>} params - Key-value pairs
 * @returns {string} URL-encoded query string
 */
export function buildQuery(params) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null) sp.append(key, String(value));
  }
  return sp.toString();
}

/**
 * Makes parallel requests and returns all results
 * @param {Array<{url: string, agentName: string}>} requests - Array of request specs
 * @returns {Promise<any[]>} Array of parsed responses in order
 * @throws {Error} If any request fails
 */
export async function fetchJsonAll(requests) {
  return Promise.all(
    requests.map(({ url, agentName, apiKey, headers }) =>
      fetchJson(url, agentName, { apiKey, headers })
    )
  );
}
