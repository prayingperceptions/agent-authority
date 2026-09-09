import { createEnterpriseServer } from './server.js';

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_required`);
  return value;
};

const server = createEnterpriseServer({
  jwt: {
    issuer: required('AUTHORITY_JWT_ISSUER'),
    audience: required('AUTHORITY_JWT_AUDIENCE'),
    jwksUri: required('AUTHORITY_JWKS_URI')
  }
});

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 8080);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid_port');

server.listen(port, host, () => {
  console.log(`agent-authority-enterprise listening on ${host}:${port}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
