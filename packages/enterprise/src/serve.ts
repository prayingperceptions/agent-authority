import { Pool } from 'pg';
import { PostgresEnterpriseStore } from './store.js';
import { createEnterpriseServer } from './server.js';

const required=(name:string)=>{const value=process.env[name];if(!value)throw new Error(`${name}_required`);return value;};
const pool=new Pool({connectionString:required('DATABASE_URL'),max:Number(process.env.DB_POOL_MAX??20),ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:process.env.DATABASE_SSL_REJECT_UNAUTHORIZED!=='false'}:undefined});
const store=new PostgresEnterpriseStore(pool);
await store.init();
const server=createEnterpriseServer({store,jwt:{issuer:required('AUTHORITY_JWT_ISSUER'),audience:required('AUTHORITY_JWT_AUDIENCE'),jwksUri:required('AUTHORITY_JWKS_URI')}});
const host=process.env.HOST??'0.0.0.0'; const port=Number(process.env.PORT??8080); if(!Number.isInteger(port)||port<1||port>65535)throw new Error('invalid_port');
server.listen(port,host,()=>console.log(`agent-authority-enterprise listening on ${host}:${port}`));
const shutdown=()=>server.close(async()=>{await pool.end();process.exit(0);}); process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
