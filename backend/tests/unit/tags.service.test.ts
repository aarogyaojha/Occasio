import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tagsService } from '../../src/modules/tags/tags.service';
import { tagsRepository, Tag } from '../../src/modules/tags/tags.repository';

vi.mock('../../src/modules/tags/tags.repository', () => ({
  tagsRepository: {
    findAll: vi.fn(),
  },
}));

describe('Tags Service (Unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllTags', () => {
    it('delegates cleanly to repository.findAll', async () => {
      const mockTags: Tag[] = [
        { id: 1, name: 'Tech', created_at: new Date('2026-01-01') },
        { id: 2, name: 'Music', created_at: new Date('2026-01-02') },
      ];
      vi.mocked(tagsRepository.findAll).mockResolvedValue(mockTags);

      const result = await tagsService.getAllTags();

      expect(tagsRepository.findAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockTags);
    });
  });
});
