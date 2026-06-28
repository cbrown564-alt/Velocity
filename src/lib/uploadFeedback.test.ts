import { describe, it, expect } from 'vitest';
import { formatUploadFailure, getLoadStageHeadline, getUploadFormatError } from './uploadFeedback';

describe('uploadFeedback', () => {
  it('getLoadStageHeadline maps parsing phase', () => {
    expect(getLoadStageHeadline({ phase: 'parsing', progress: 0.2, message: '' })).toBe('Parsing variables…');
  });

  it('getLoadStageHeadline prefers row-load messages', () => {
    expect(
      getLoadStageHeadline({
        phase: 'inserting',
        progress: 0.5,
        message: 'Loaded 500 of 1,000 rows...',
      }),
    ).toBe('Building index…');
  });

  it('getUploadFormatError guides Excel uploads', () => {
    const err = getUploadFormatError('survey.xlsx');
    expect(err?.title).toMatch(/Excel/i);
    expect(err?.message).toMatch(/CSV/i);
  });

  it('getUploadFormatError returns null for sav', () => {
    expect(getUploadFormatError('data.sav')).toBeNull();
  });

  it('formatUploadFailure surfaces OPFS lock copy', () => {
    const err = formatUploadFailure(new Error('another open access handle'), 'a.sav');
    expect(err.message).toMatch(/another Velocity tab/i);
  });
});
