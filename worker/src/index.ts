import OAuthProvider from '@cloudflare/workers-oauth-provider';
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
    return providerFor(request).fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
