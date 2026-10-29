import { getAccessKey, setAccessKey, clearAccessKey, aiHeaders } from './accessKey';

beforeEach(() => window.localStorage.clear());

describe('access key storage', () => {
  it('stores, reads and clears the key', () => {
    expect(getAccessKey()).toBe('');
    setAccessKey('  abc123  ');
    expect(getAccessKey()).toBe('abc123');
    clearAccessKey();
    expect(getAccessKey()).toBe('');
  });

  it('adds the header only when a key is stored, and keeps other headers', () => {
    expect(aiHeaders({ 'Content-Type': 'application/json' })).toEqual({ 'Content-Type': 'application/json' });
    setAccessKey('abc123');
    expect(aiHeaders({ 'Content-Type': 'application/json' })).toEqual({
      'Content-Type': 'application/json',
      'X-AI-Access-Key': 'abc123',
    });
  });

  it('survives storage being unavailable', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(getAccessKey()).toBe('');
    expect(aiHeaders()).toEqual({});
    spy.mockRestore();
  });
});
