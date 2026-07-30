// Cloudflare Pages Function: /api/scan
import { readAll, scanTasks, jsonResponse } from '../../lib/storage.mjs';

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const data = await readAll(env);
    const result = scanTasks(data);
    return jsonResponse(result);
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }});
}
