import { Request, Response } from 'express';
import { tagsService } from './tags.service';
import { sendResponse } from '../../utils/sendResponse';
import { httpStatus } from '../../constants';

export const tagsController = {
  /**
   * Retrieves all tags in the system.
   *
   * @param req - Express request object.
   * @param res - Express response object.
   */
  async list(_req: Request, res: Response): Promise<void> {
    const tags = await tagsService.getAllTags();
    sendResponse(res, httpStatus.OK, tags);
  },
};
