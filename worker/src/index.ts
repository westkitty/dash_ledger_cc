import { OAuthProvider } from '@cloudflare/workers-oauth-provider';
import type { Env } from './env';
import { defaultHandler } from './auth';
import { mcpApiHandler } from './mcp';

function providerFor(request: Request) {
  const origin = new URL(request.url).origin;
  return new OAuthProvider<Env>({
    apiRoute: '/mcp',
    apiHandler: mcpApiHandler,
    defaultHandler,
    authorizeEndpoint: '/authorize',
    tokenEndpoint: '/oauth/token',
    clientRegistrationEndpoint: '/oauth/register',
    scopesSupported: ['ledger.read', 'ledger.propose', 'offline_access'],
    resourceMetadata: {
      resource: origin + '/mcp',
      authorization_servers: [origin],
    },
    requiredScopes: ['ledger.read'],
    clientIdMetadataDocumentEnabled: true,
  });
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    // Serve OpenAI plugin domain verification outside the OAuth provider,
    // which owns other /.well-known OAuth discovery routes.
    if (
      url.pathname === '/.well-known/openai-apps-challenge' &&
      request.method === 'GET'
    ) {
      const token = env.OPENAI_APPS_CHALLENGE_TOKEN?.trim();
      return token
        ? new Response(token, {
            status: 200,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Cache-Control': 'no-store',
              'X-Content-Type-Options': 'nosniff',
            },
          })
        : new Response('not_configured', {
            status: 404,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Cache-Control': 'no-store',
            },
          });
    }
    return providerFor(request).fetch(request, env, ctx);
  },
};
