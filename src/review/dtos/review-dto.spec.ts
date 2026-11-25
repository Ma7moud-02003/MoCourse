import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreatCommentDto } from './cret-comment.dto';
import { UpdateCommentDto } from './updateRevier.dto';

const createErrors = async (body: object) =>
  validate(plainToInstance(CreatCommentDto, { comment: 'a valid comment', ...body }));

describe('CreatCommentDto rating validation', () => {
  it('accepts whole-number ratings 0 and 5', async () => {
    expect(await createErrors({ rateing: 0 })).toHaveLength(0);
    expect(await createErrors({ rateing: 5 })).toHaveLength(0);
  });

  it('rejects fractional ratings instead of dying at the database with a 500', async () => {
    for (const rateing of [2.5, 0.5, 4.5]) {
      const errors = await createErrors({ rateing });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('rateing');
    }
  });

  it('rejects out-of-range and non-numeric ratings', async () => {
    expect((await createErrors({ rateing: 6 })).length).toBeGreaterThan(0);
    expect((await createErrors({ rateing: -1 })).length).toBeGreaterThan(0);
    expect((await createErrors({ rateing: 'abc' })).length).toBeGreaterThan(0);
  });
});

describe('UpdateCommentDto rating validation', () => {
  const updateErrors = (body: object) => validate(plainToInstance(UpdateCommentDto, body));

  it('accepts a partial update with a whole-number rating', async () => {
    expect(await updateErrors({ rateing: 4 })).toHaveLength(0);
  });

  it('rejects a fractional rating on update', async () => {
    const errors = await updateErrors({ rateing: 3.5 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('rateing');
  });

  it('still allows an empty partial update', async () => {
    expect(await updateErrors({})).toHaveLength(0);
  });
});
