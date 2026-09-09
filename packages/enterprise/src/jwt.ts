import { createPublicKey, createVerify, verify as verifySignature } from 'node:crypto';

export interface JwtOptions { issuer: string; audience: string; jwksUri: string; clockSkewSeconds?: number; }
export interface Principal { tenantId: string; subject: string; roles: string[]; }
type Jwk = JsonWebKey & { kid?: string; alg?: string };
const cache = new Map<string, { at: number; keys: Jwk[] }>();

const decode = (x: string) => Buffer.from(x.replace(/-/g,'+').replace(/_/g,'/') + '='.repeat((4-x.length%4)%4), 'base64');

async function keys(uri: string): Promise<Jwk[]> {
  const cached = cache.get(uri);
  if (cached && Date.now()-cached.at < 300_000) return cached.keys;
  const r = await fetch(uri, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error('jwks_unavailable');
  const body = await r.json() as { keys?: Jwk[] };
  if (!Array.isArray(body.keys) || !body.keys.length) throw new Error('jwks_invalid');
  cache.set(uri, { at: Date.now(), keys: body.keys.filter(k => typeof k.kid === 'string') });
  return body.keys;
}

export async function verifyJwt(authorization: string | undefined, options: JwtOptions): Promise<Principal> {
  if (!authorization?.startsWith('Bearer ')) throw new Error('missing_bearer_token');
  const [h,p,s] = authorization.slice(7).trim().split('.');
  if (!h || !p || !s) throw new Error('malformed_jwt');
  let header: any, claims: any;
  try { header=JSON.parse(decode(h).toString('utf8')); claims=JSON.parse(decode(p).toString('utf8')); } catch { throw new Error('malformed_jwt'); }
  const allowed=['RS256','RS384','RS512','ES256','ES384','ES512','EdDSA'];
  if (!header.kid || !allowed.includes(header.alg)) throw new Error('jwt_header_rejected');
  if (header.typ && !['JWT','at+jwt'].includes(header.typ)) throw new Error('jwt_type_rejected');
  const now=Math.floor(Date.now()/1000), skew=options.clockSkewSeconds ?? 60;
  if (claims.iss !== options.issuer) throw new Error('jwt_issuer_mismatch');
  const aud=claims.aud; if (!(aud===options.audience || (Array.isArray(aud)&&aud.includes(options.audience)))) throw new Error('jwt_audience_mismatch');
  if (typeof claims.exp!=='number' || now>claims.exp+skew) throw new Error('jwt_expired');
  if (typeof claims.nbf==='number' && now+skew<claims.nbf) throw new Error('jwt_not_yet_valid');
  if (typeof claims.sub!=='string' || !claims.sub) throw new Error('jwt_subject_missing');
  const jwk=(await keys(options.jwksUri)).find(k=>k.kid===header.kid); if(!jwk) throw new Error('jwks_kid_not_found');
  let key; try { key=createPublicKey({key:jwk as any,format:'jwk'}); } catch { throw new Error('jwks_key_invalid'); }
  const input=Buffer.from(`${h}.${p}`), sig=decode(s);
  let ok=false;
  if(header.alg==='EdDSA') ok=verifySignature(null,input,key,sig);
  else { const hash=header.alg.endsWith('256')?'sha256':header.alg.endsWith('384')?'sha384':'sha512'; const v=createVerify(hash); v.update(input); v.end(); ok=header.alg.startsWith('ES')?v.verify({key,dsaEncoding:'ieee-p1363'},sig):v.verify(key,sig); }
  if(!ok) throw new Error('jwt_signature_invalid');
  if(typeof claims.tenant_id!=='string' || !claims.tenant_id) throw new Error('tenant_claim_missing');
  const roles=Array.isArray(claims.roles)?claims.roles.filter((x:any)=>typeof x==='string'):[];
  return {tenantId:claims.tenant_id,subject:claims.sub,roles};
}
