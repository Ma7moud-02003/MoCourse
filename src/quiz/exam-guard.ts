import { ConflictException } from '@nestjs/common';
import { EntityManager, FindOptionsWhere, In } from 'typeorm';
import { QuizEntity } from './quiz.entity';
import { QuizAttemptEntity } from 'src/quiz-attempt/quiz-attemp.entity';

/**
 * Used inside a transaction before a delete that cascades to exams (section, lesson).
 * Locks the matching exams (ordered by id, so no deadlock), then refuses with 409 if any
 * student already attempted one. A student cannot start while the lock is held.
 */
export async function assertNoExamAttempts(
  manager: EntityManager,
  where: FindOptionsWhere<QuizEntity>[] | FindOptionsWhere<QuizEntity>,
  message: string,
) {
  const exams = await manager.find(QuizEntity, { where, select: { id: true }, order: { id: 'ASC' } });
  if (!exams.length) return;
  const ids = exams.map((e) => e.id);
  await manager.find(QuizEntity, { where: { id: In(ids) }, select: { id: true }, order: { id: 'ASC' }, lock: { mode: 'pessimistic_write' } });
  const attempts = await manager.count(QuizAttemptEntity, { where: { quiz: { id: In(ids) } } });
  if (attempts > 0) throw new ConflictException(message);
}
