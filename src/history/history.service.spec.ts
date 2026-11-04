import { NotFoundException } from '@nestjs/common';
import { HistoryService } from './history.service';

describe('HistoryService', () => {
  const findMany = jest.fn().mockResolvedValue([]);
  const findUnique = jest.fn();
  const service = new HistoryService({ historyLog: { findMany, findUnique } } as never);

  beforeEach(() => jest.clearAllMocks());

  it('lists the latest runs first, 50 by default and never more than 200', async () => {
    await service.findAll();
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: {}, orderBy: { createdAt: 'desc' }, take: 50 }),
    );
    await service.findAll(undefined, 5000);
    expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 200 }));
    await service.findAll(undefined, 0);
    expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 50 }));
  });

  it('filters by request and by the workspace the request belongs to', async () => {
    await service.findAll('req-1', 10, 'ws-1');
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { requestId: 'req-1', request: { collection: { workspaceId: 'ws-1' } } },
        take: 10,
      }),
    );
  });

  it('does not select the bodies in the list', async () => {
    await service.findAll();
    const { select } = findMany.mock.calls[0][0];
    expect(select.responseBody).toBeUndefined();
    expect(select.responseHeaders).toBeUndefined();
  });

  it('returns one run, or 404 when it does not exist', async () => {
    findUnique.mockResolvedValueOnce({ id: 'a' });
    await expect(service.findOne('a')).resolves.toEqual({ id: 'a' });
    findUnique.mockResolvedValueOnce(null);
    await expect(service.findOne('x')).rejects.toBeInstanceOf(NotFoundException);
  });
});
