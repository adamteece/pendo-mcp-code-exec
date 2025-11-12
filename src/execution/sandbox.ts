import { Worker } from 'worker_threads';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';

export interface ExecutionResult {
  success: boolean;
  output?: any;
  logs: string[];
  error?: string;
  stats: {
    duration: number;
    memoryUsed: number;
  };
}

export interface ExecutionOptions {
  timeout?: number;        // milliseconds
  maxMemory?: number;      // bytes
  allowedPaths?: string[]; // allowed file paths
}

/**
 * CodeExecutor runs user code in a sandboxed environment using Worker threads
 */
export class CodeExecutor {
  private readonly defaultOptions: ExecutionOptions = {
    timeout: 30000,          // 30 seconds
    maxMemory: 512 * 1024 * 1024,  // 512MB
    allowedPaths: ['./servers', './skills', './cache']
  };

  /**
   * Execute TypeScript/JavaScript code in a sandboxed environment
   */
  async execute(
    code: string,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const opts = { ...this.defaultOptions, ...options };
    const logs: string[] = [];
    const startTime = Date.now();

    try {
      // Wrap code with logging capture and result handling
      const wrappedCode = this.wrapCode(code);

      // Create temporary file for execution
      const tempFile = join(tmpdir(), `pendo-exec-${randomBytes(8).toString('hex')}.mjs`);
      await writeFile(tempFile, wrappedCode);

      // Execute in worker thread with timeout
      const result = await this.executeInWorker(tempFile, opts, logs);

      // Clean up temp file
      await unlink(tempFile).catch(() => {}); // Ignore cleanup errors

      const duration = Date.now() - startTime;

      if (result.success) {
        return {
          success: true,
          output: result.output,
          logs: result.logs || logs,
          stats: {
            duration,
            memoryUsed: result.memoryUsed || 0
          }
        };
      } else {
        return {
          success: false,
          error: result.error,
          logs: result.logs || logs,
          stats: {
            duration,
            memoryUsed: result.memoryUsed || 0
          }
        };
      }

    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        logs,
        stats: {
          duration: Date.now() - startTime,
          memoryUsed: 0
        }
      };
    }
  }

  /**
   * Wrap user code with logging and error handling
   */
  private wrapCode(code: string): string {
    return `
import { parentPort } from 'worker_threads';

// Capture console output
const logs = [];
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args) => {
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  logs.push(message);
  originalLog(...args);
};

console.error = (...args) => {
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  logs.push('ERROR: ' + message);
  originalError(...args);
};

console.warn = (...args) => {
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  logs.push('WARN: ' + message);
  originalWarn(...args);
};

// Track memory usage
const memoryBefore = process.memoryUsage().heapUsed;

// Execute user code
(async () => {
  try {
    // User code starts here
    ${code}

    // User code ends here

    const memoryAfter = process.memoryUsage().heapUsed;

    // Send success result back to parent
    parentPort?.postMessage({
      success: true,
      output: null, // Output should be logged by user code
      logs,
      memoryUsed: memoryAfter - memoryBefore
    });

  } catch (error) {
    // Send error result back to parent
    parentPort?.postMessage({
      success: false,
      error: error.message + '\\n' + error.stack,
      logs
    });
  }
})();
    `.trim();
  }

  /**
   * Execute code in a worker thread with timeout
   */
  private executeInWorker(
    scriptPath: string,
    options: ExecutionOptions,
    logs: string[]
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(scriptPath);
      let timeoutHandle: NodeJS.Timeout;

      // Set up timeout
      if (options.timeout) {
        timeoutHandle = setTimeout(() => {
          worker.terminate();
          reject(new Error(`Execution timeout after ${options.timeout}ms`));
        }, options.timeout);
      }

      // Handle messages from worker
      worker.on('message', (result) => {
        clearTimeout(timeoutHandle);
        worker.terminate();
        resolve(result);
      });

      // Handle worker errors
      worker.on('error', (error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      });

      // Handle worker exit
      worker.on('exit', (code) => {
        clearTimeout(timeoutHandle);
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  }
}

/**
 * Create a simple sandbox for quick testing (not as secure as Worker)
 */
export class SimpleSandbox {
  async execute(code: string): Promise<ExecutionResult> {
    const logs: string[] = [];
    const startTime = Date.now();

    // Override console in eval context
    const captureLog = (...args: any[]) => {
      logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
    };

    const sandbox = {
      console: {
        log: captureLog,
        error: captureLog,
        warn: captureLog,
      },
    };

    try {
      // Create async function and execute
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction(
        'console',
        `
        ${code}
        `
      );

      await fn(sandbox.console);

      return {
        success: true,
        logs,
        stats: {
          duration: Date.now() - startTime,
          memoryUsed: 0
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message + '\n' + error.stack,
        logs,
        stats: {
          duration: Date.now() - startTime,
          memoryUsed: 0
        }
      };
    }
  }
}
