import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INTERVAL_HOURS = 2;
const INTERVAL_MS = INTERVAL_HOURS * 60 * 60 * 1000;

function runFetch() {
    console.log(`[${new Date().toISOString()}] Triggering news fetch...`);

    // Run 'npm run fetch-news'
    const child = spawn('npm', ['run', 'fetch-news'], {
        stdio: 'inherit',
        shell: true,
        cwd: path.join(__dirname, '..')
    });

    child.on('close', (code) => {
        console.log(`[${new Date().toISOString()}] News fetch finished with code ${code}.`);
        console.log(`Waiting ${INTERVAL_HOURS} hours for next run...`);
    });
}

// Run immediately
runFetch();

// Schedule loop
setInterval(runFetch, INTERVAL_MS);

console.log(`Local News Scheduler started. Running every ${INTERVAL_HOURS} hours.`);
console.log('Press Ctrl+C to stop.');
