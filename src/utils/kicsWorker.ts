const { parentPort, workerData } = require('worker_threads');

console.log("dentro",workerData);