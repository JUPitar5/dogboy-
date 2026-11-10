import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l => l.includes('=')).map(l => { const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')]; }));
Object.assign(process.env, env);
const input=JSON.parse(process.argv[2]);
const handler=(await import(`../api/${input.resource}.js`)).default;
const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},json(data){process.stdout.write(JSON.stringify({status:this.code,headers:this.headers,data}));},end(){process.stdout.write(JSON.stringify({status:this.code,headers:this.headers,data:null}));}};
await handler({method:input.method||'GET',query:input.query||{},body:input.body||{},headers:input.headers||{}},res);
