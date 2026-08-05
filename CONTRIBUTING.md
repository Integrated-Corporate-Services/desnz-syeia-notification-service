# Contributing

We welcome contributions to this project. By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

- Check if the issue already exists in GitHub Issues
- Use the bug report template when creating a new issue
- Include clear steps to reproduce the problem
- Provide relevant logs and error messages

### Suggesting Enhancements

- Check if the enhancement has already been suggested
- Provide a clear description of the proposed feature
- Explain why this enhancement would be useful

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** following the coding standards below
3. **Write tests** for your changes
4. **Ensure all tests pass**: `npm test`
5. **Run linting**: `npm run lint`
6. **Update documentation** if needed
7. **Submit a pull request** with a clear description of changes

## Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/notification-service.git

# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm run dev
```

## Coding Standards

- Follow TypeScript best practices
- Write meaningful commit messages
- Add tests for new functionality
- Maintain test coverage
- Document public APIs and complex logic

## Testing

- Write unit tests for new functions and classes
- Write integration tests for API endpoints
- Ensure all tests pass before submitting PR
- Aim for high test coverage

## Commit Messages

Use clear and descriptive commit messages:

```
feat: add webhook retry mechanism
fix: correct signature verification logic
docs: update API documentation
test: add integration tests for callbacks
refactor: simplify error handling
```

## Code Review Process

- All submissions require review
- Reviewers may request changes
- Once approved, maintainers will merge
- Keep PRs focused and reasonably sized

## Questions?

Feel free to open an issue for questions or clarifications.

Thank you for contributing!
