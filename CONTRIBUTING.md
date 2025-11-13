# Contributing to Pendo MCP Code Execution

Thank you for your interest in contributing! This document provides guidelines for contributing to this project.

## Development Setup

1. **Clone the repository**

```bash
git clone https://github.com/adamteece/pendo-mcp-code-exec.git
cd pendo-mcp-code-exec
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Copy `.env.example` to `.env` and fill in your Pendo credentials:

```bash
cp .env.example .env
```

4. **Build the project**

```bash
npm run build
```

5. **Run tests**

```bash
npm test
```

## Project Structure

```
pendo-mcp-code-execution/
├── src/
│   ├── server/           # MCP server implementation
│   ├── execution/        # Sandboxed code execution
│   ├── wrappers/         # Wrapper generation system
│   ├── cache/            # Caching utilities
│   └── utils/            # Utility functions
├── servers/              # Generated Pendo tool wrappers
├── skills/               # Reusable analysis functions
├── tests/                # Test files
└── cache/                # Query result cache
```

## Coding Standards

- **TypeScript**: Use TypeScript for all code
- **Formatting**: Run `npm run format` before committing
- **Linting**: Run `npm run lint` to check code quality
- **Tests**: Write tests for new features
- **Documentation**: Update README.md for user-facing changes

## Adding New Skills

Skills are reusable TypeScript functions that help with common Pendo analysis tasks.

1. Create a new file in `skills/pendo-helpers/`
2. Export well-documented functions with TypeScript interfaces
3. Add examples in JSDoc comments
4. Test your skill thoroughly

Example:

```typescript
// skills/pendo-helpers/my-analysis.ts

import { activityQuery } from '../../servers/pendo/activityQuery.js';

export interface MyAnalysisResult {
  // Define result interface
}

/**
 * Description of what this function does
 *
 * @example
 * ```typescript
 * const result = await myAnalysis({
 *   subId: 'your-sub-id',
 *   // ... other params
 * });
 * ```
 */
export async function myAnalysis(config: {
  subId: string;
  // ... other params
}): Promise<MyAnalysisResult> {
  // Implementation
}
```

## Submitting Changes

1. **Fork the repository**
2. **Create a feature branch**

```bash
git checkout -b feature/my-new-feature
```

3. **Make your changes**
4. **Run tests**

```bash
npm test
```

5. **Commit your changes**

```bash
git commit -m "Add: Description of changes"
```

Use conventional commit messages:
- `Add:` for new features
- `Fix:` for bug fixes
- `Update:` for improvements
- `Docs:` for documentation changes
- `Test:` for test changes

6. **Push to your fork**

```bash
git push origin feature/my-new-feature
```

7. **Create a Pull Request**

Open a pull request on GitHub with:
- Clear description of changes
- Reference to any related issues
- Screenshots or examples if applicable

## Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Update documentation as needed
- Add tests for new functionality
- Ensure all tests pass
- Follow existing code style

## Reporting Issues

When reporting issues, please include:

- **Description**: Clear description of the issue
- **Steps to Reproduce**: How to reproduce the problem
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Environment**: OS, Node.js version, package version
- **Logs**: Any relevant error messages or logs

## Feature Requests

We welcome feature requests! Please:

- Check if the feature already exists or has been requested
- Provide a clear use case
- Describe the expected behavior
- Consider implementation complexity

## Code Review Process

1. Maintainers will review your PR
2. Address any feedback or requested changes
3. Once approved, maintainers will merge your PR

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

Feel free to open an issue for any questions or reach out to the maintainers.

Thank you for contributing! 🎉
