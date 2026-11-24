import { EntityManager } from 'typeorm';
import { QuizEntity } from './quiz.entity';
import { QuestionEntity } from 'src/question/question.entity';

/**
 * Set the exam's totalMarks to the sum of its question marks.
 * Call inside the transaction that already changed the questions.
 */
export async function syncTotalMarks(manager: EntityManager, quizId: number): Promise<number> {
  const total = (await manager.sum(QuestionEntity, 'mark', { quiz: { id: quizId } })) ?? 0;
  await manager.update(QuizEntity, { id: quizId }, { totalMarks: total });
  return total;
}
