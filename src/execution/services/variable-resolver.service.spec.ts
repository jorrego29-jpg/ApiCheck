import { VariableResolverService } from './variable-resolver.service';

describe('VariableResolverService', () => {
  const resolver = new VariableResolverService();

  describe('resolveVariables', () => {
    it('replaces {{variables}}, with or without spaces inside the braces', () => {
      expect(
        resolver.resolveVariables('{{host}}/users/{{ id }}', { host: 'https://api.test', id: '7' }),
      ).toBe('https://api.test/users/7');
    });

    it('leaves a variable without a value as it was written', () => {
      expect(resolver.resolveVariables('{{host}}/{{missing}}', { host: 'h' })).toBe(
        'h/{{missing}}',
      );
    });

    it('does not resolve names inherited from Object', () => {
      expect(resolver.resolveVariables('{{constructor}}', {})).toBe('{{constructor}}');
    });

    it('accepts an empty value', () => {
      expect(resolver.resolveVariables('a{{x}}b', { x: '' })).toBe('ab');
    });

    it('returns empty input untouched', () => {
      expect(resolver.resolveVariables('', { x: '1' })).toBe('');
    });
  });

  describe('resolveObject', () => {
    it('replaces variables inside nested values', () => {
      const result = resolver.resolveObject(
        { headers: { Authorization: 'Bearer {{token}}' }, list: ['{{a}}', 'b'] },
        { token: 'abc', a: '1' },
      );

      expect(result).toEqual({ headers: { Authorization: 'Bearer abc' }, list: ['1', 'b'] });
    });

    it('keeps the JSON valid when a value has quotes, backslashes or new lines', () => {
      const password = 'p"ss\\word\nline2';

      const result = resolver.resolveObject({ pass: '{{password}}' }, { password });

      expect(result).toEqual({ pass: password });
    });

    it('cannot inject extra keys through a value', () => {
      const result = resolver.resolveObject({ a: '{{x}}' }, { x: '","admin":"true' });

      expect(result).toEqual({ a: '","admin":"true' });
    });

    it('resolves a raw JSON text body as text', () => {
      const body = '{ "user": "{{user}}", "n": {{count}} }';

      const result = resolver.resolveObject(body, { user: 'ana', count: '3' });

      expect(result).toBe('{ "user": "ana", "n": 3 }');
    });

    it('returns empty input untouched', () => {
      expect(resolver.resolveObject(undefined, { x: '1' })).toBeUndefined();
    });
  });
});
