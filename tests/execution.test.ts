import { describe, it, expect } from 'vitest';
import { CodeExecutor, SimpleSandbox } from '../src/execution/sandbox';

describe('Code Execution', () => {
  describe('SimpleSandbox', () => {
    const sandbox = new SimpleSandbox();

    it('should execute simple code', async () => {
      const code = `
        const result = { message: 'Hello World' };
        console.log(JSON.stringify(result));
      `;

      const result = await sandbox.execute(code);

      expect(result.success).toBe(true);
      expect(result.logs.length).toBeGreaterThan(0);
      expect(result.logs[0]).toContain('Hello World');
    });

    it('should capture console.log output', async () => {
      const code = `
        console.log('Line 1');
        console.log('Line 2');
        console.log({ key: 'value' });
      `;

      const result = await sandbox.execute(code);

      expect(result.success).toBe(true);
      expect(result.logs).toHaveLength(3);
      expect(result.logs[0]).toBe('Line 1');
      expect(result.logs[1]).toBe('Line 2');
      expect(result.logs[2]).toContain('key');
    });

    it('should handle async code', async () => {
      const code = `
        await new Promise(resolve => setTimeout(resolve, 10));
        console.log('Async complete');
      `;

      const result = await sandbox.execute(code);

      expect(result.success).toBe(true);
      expect(result.logs).toContain('Async complete');
    });

    it('should handle errors gracefully', async () => {
      const code = `
        throw new Error('Test error');
      `;

      const result = await sandbox.execute(code);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Test error');
    });

    it('should handle syntax errors', async () => {
      const code = `
        const x = {
          invalid syntax here
        };
      `;

      const result = await sandbox.execute(code);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should provide execution stats', async () => {
      const code = `
        console.log('Test');
      `;

      const result = await sandbox.execute(code);

      expect(result.stats).toBeDefined();
      expect(result.stats.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('CodeExecutor', () => {
    const executor = new CodeExecutor();

    it('should execute simple code in worker', async () => {
      const code = `
        console.log('Hello from worker');
      `;

      const result = await executor.execute(code);

      expect(result.success).toBe(true);
      expect(result.logs).toContain('Hello from worker');
    }, 10000); // Increased timeout for worker execution

    it('should handle timeouts', async () => {
      const code = `
        await new Promise(resolve => setTimeout(resolve, 5000));
      `;

      const result = await executor.execute(code, { timeout: 1000 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    }, 10000);

    it('should track memory usage', async () => {
      const code = `
        const bigArray = new Array(1000).fill('test');
        console.log('Memory test');
      `;

      const result = await executor.execute(code);

      expect(result.success).toBe(true);
      expect(result.stats.memoryUsed).toBeGreaterThanOrEqual(0);
    }, 10000);
  });
});
