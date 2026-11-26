import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CategoryDto } from './dtos/cat.dto';
import { CategoryController } from './category.controller';
import { AuthGuard } from 'src/common/Guards/auth.guard';
import { Roleguard } from 'src/common/Guards/role.guard';

const errs = async (name: any) => validate(plainToInstance(CategoryDto, { name }));

describe('category name length', () => {
  it('accepts 2 characters', async () => expect(await errs('IT')).toHaveLength(0));
  it('rejects 1 character', async () => expect(await errs('I')).not.toHaveLength(0));
  it('rejects empty', async () => expect(await errs('')).not.toHaveLength(0));
  it('rejects over 100', async () => expect(await errs('a'.repeat(101))).not.toHaveLength(0));
});

describe('category routes', () => {
  const guards = (m: string) => Reflect.getMetadata('__guards__', (CategoryController.prototype as any)[m]);
  it('list needs login only, no role restriction', () => {
    expect(guards('getAll')).toEqual([AuthGuard]);
    expect(Reflect.getMetadata('roles', (CategoryController.prototype as any).getAll)).toBeUndefined();
  });
  it('create keeps auth + role guard', () => {
    expect(guards('addCatog')).toEqual([AuthGuard, Roleguard]);
  });
});
