import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateQuizDto } from './creat.dto';
import { UpdateQuizDto } from './update.dto';

const base = { title: 'Quiz', timeLimit: 10, quizTarget: 'course', courseId: 5 };
const passErrors = async (cls: any, data: any) =>
  (await validate(plainToInstance(cls, data))).filter((e) => e.property === 'passMark');

describe('passMark range is 0 to 100 on create and update', () => {
  for (const v of [0, 60, 100]) {
    it(`accepts ${v} on create and update`, async () => {
      expect(await passErrors(CreateQuizDto, { ...base, passMark: v })).toHaveLength(0);
      expect(await passErrors(UpdateQuizDto, { passMark: v })).toHaveLength(0);
    });
  }
  for (const v of [-1, 101]) {
    it(`rejects ${v} on create and update`, async () => {
      expect(await passErrors(CreateQuizDto, { ...base, passMark: v })).toHaveLength(1);
      expect(await passErrors(UpdateQuizDto, { passMark: v })).toHaveLength(1);
    });
  }
});
