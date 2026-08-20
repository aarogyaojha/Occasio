import { tagsRepository, Tag } from './tags.repository';

export const tagsService = {
  /**
   * Retrieves a list of all available tags.
   *
   * @returns An array of tag records.
   */
  async getAllTags(): Promise<Tag[]> {
    return tagsRepository.findAll();
  },
};
