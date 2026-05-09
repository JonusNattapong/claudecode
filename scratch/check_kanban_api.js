
import { startKanbanServer } from '../src/utils/kanban/server.ts';
import { resolve } from 'path';

const rootDir = resolve('.');
console.log('Starting test server at', rootDir);

const { url, close } = await startKanbanServer({ port: 0, rootDir });
console.log('Server started at', url);

const res = await fetch(url + '/api/tasks');
const data = await res.json();
console.log('Tasks:', JSON.stringify(data, null, 2));

close();
process.exit(0);
