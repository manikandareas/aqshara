import { buildBullConnection } from '../queue.connection';

describe('buildBullConnection', () => {
  it('maps redis url parts to bull connection options', () => {
    const connection = buildBullConnection(
      'redis://user:pass@localhost:6380/2',
    );

    expect(connection).toMatchObject({
      host: 'localhost',
      port: 6380,
      username: 'user',
      password: 'pass',
      db: 2,
    });
  });
});
