import type { APIRoute } from 'astro';
import { buildLlmsFullTxt } from '../lib/site';

export const GET: APIRoute = () =>
  new Response(buildLlmsFullTxt(), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
