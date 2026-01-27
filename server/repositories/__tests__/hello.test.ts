import { describe, it, expect } from 'vitest';

describe('Hello World Test', () => {
  it('should pass a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should verify the test runner works', () => {
    expect(true).toBe(true);
  });

  it('should handle string operations', () => {
    expect('hello'.toUpperCase()).toBe('HELLO');
  });
});
