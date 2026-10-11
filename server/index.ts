import path from 'node:path';
import {createApp} from './app.js';
const server=createApp({dataDir:process.env.DATA_DIR||path.resolve('data'),staticDir:path.resolve('dist')});
const port=Number(process.env.PORT||3001);
server.http.listen(port,'0.0.0.0',()=>console.log(`Hanabi ready at http://localhost:${port}`));
for(const signal of ['SIGTERM','SIGINT'] as const)process.on(signal,()=>{void server.close().then(()=>process.exit(0));});
