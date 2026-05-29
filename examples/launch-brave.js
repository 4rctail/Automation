import { launchBrave } from '../src/launchers/brave.js';

const result = launchBrave({ port: Number(process.env.BRAVE_CDP_PORT ?? 9223) });
console.log('Brave launched with CDP endpoint:', result.endpoint);
console.log('PID:', result.pid);
