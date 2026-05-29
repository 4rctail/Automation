import { launchEdge } from '../src/launchers/edge.js';

const result = launchEdge({ port: Number(process.env.EDGE_CDP_PORT ?? 9222) });
console.log('Edge launched with CDP endpoint:', result.endpoint);
console.log('PID:', result.pid);
