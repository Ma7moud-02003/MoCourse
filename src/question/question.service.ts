import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QuestionEntity } from './question.entity';
import { Repository } from 'typeorm';
import { CreateQuestionsDto } from './dtos/question.dto';
import { QuizService } from 'src/quiz/quiz.service';
import { UpdateQuestionDto } from './dtos/updateQuestion.dto';
import { ChoiceEntity } from 'src/choice/choise.entity';


@Injectable()
export class QuestionService {
    constructor(
        @InjectRepository(QuestionEntity)
        private repo:Repository<QuestionEntity>,
        @InjectRepository(ChoiceEntity)
        private choiceRepo:Repository<ChoiceEntity>,
        private quizService:QuizService,


    ){}

public async addQuestins(insId:number,dto:CreateQuestionsDto){
if(!insId||!dto.quizId||!dto.questions.length) throw new BadRequestException();
const insVerifyed=await this.quizService.verifyingInstractors(dto.quizId,insId);
if(!insVerifyed) throw new ForbiddenException();
const questions=dto.questions.map(questionDto=>{
    const question=this.repo.create({
        question:questionDto.question,
        type:questionDto.type,
        mark:questionDto.mark,
        order:questionDto.order,
        quiz:{id:dto.quizId},
        choices:questionDto.choices.map(choise=>({
            text:choise.text,
            order:choise.order,
            isCorrect:choise.isCorrect
        }))

    })
    return question;
})
return await this.repo.save(questions)
}

public async updateQuestion(insId: number, questionId: number, dto: UpdateQuestionDto) {
  if (!insId || !questionId) {
    throw new BadRequestException('Instructor ID and Question ID are required');
  }

  const existingQuestion = await this.repo.findOne({
    where: { id: questionId },
    relations: ['quiz', 'choices'],
  });

  if (!existingQuestion) {
    throw new NotFoundException('Question not found');
  }

  const insVerified = await this.quizService.verifyingInstractors(
    existingQuestion.quiz.id,
    insId,
  );
  if (!insVerified) {
    throw new ForbiddenException('You do not have permission to update this question');
  }

  return this.repo.manager.transaction(async (manager) => {
    existingQuestion.question = dto.question ?? existingQuestion.question;
    existingQuestion.type = dto.type ?? existingQuestion.type;
    existingQuestion.mark = dto.mark ?? existingQuestion.mark;
    existingQuestion.order = dto.order ?? existingQuestion.order;

    if (dto.choices) {
      const existingById = new Map(existingQuestion.choices.map((c) => [c.id, c]));

      // أي id مبعوت لازم يكون تبع نفس السؤال
      for (const incoming of dto.choices) {
        if (incoming.id !== undefined && !existingById.has(incoming.id)) {
          throw new BadRequestException(
            `Choice ${incoming.id} does not belong to this question`,
          );
        }
      }

      // امسح بس الاختيارات اللي اتشالت
      const keptIds = new Set(
        dto.choices.filter((c) => c.id !== undefined).map((c) => c.id),
      );
      const removed = existingQuestion.choices.filter((c) => !keptIds.has(c.id));
      if (removed.length > 0) {
        await manager.remove(removed);
      }

      // حدّث الموجود في مكانه، وأنشئ الجديد
      existingQuestion.choices = dto.choices.map((incoming) => {
        const current =
          incoming.id !== undefined ? existingById.get(incoming.id) : undefined;

        if (current) {
          current.text = incoming.text ?? current.text;
          current.order = incoming.order ?? current.order;
          current.isCorrect = incoming.isCorrect ?? current.isCorrect;
          return current;
        }

        return manager.create(ChoiceEntity, {
          text: incoming.text,
          order: incoming.order,
          isCorrect: incoming.isCorrect,
        });
      });
    }

    return manager.save(existingQuestion);
  });
}

async  deleteQuestions(questionId:number,insId:number){
if(!questionId||!insId) throw new BadRequestException();
const question=await this.repo.findOne({
    where:{id:questionId},relations:{quiz:true},select:{quiz:{id:true,isPublished:true}}
})
if(!question) throw new NotFoundException();


  const verified = await this.quizService.verifyingInstractors(
    question.quiz.id,
    insId,
  );

  if (!verified) {
    throw new ForbiddenException();
  }
  if (question.quiz.isPublished) {
    const questionsCount = await this.repo.count({ where: { quiz: { id: question.quiz.id } } });
    if (questionsCount <= 1) {
      throw new BadRequestException('Unpublish the exam before deleting its last question');
    }
  }
  return  this.repo.remove(question);
}









async getQuizQuestions(quizId:number,insId:number){
if(!quizId||!insId) throw new BadRequestException();
const insVerifyed=await this.quizService.verifyingInstractors(quizId,insId);
if(!insVerifyed) throw new ForbiddenException();
const questions=await this.repo.find({
    where:{quiz:{id:quizId}},relations:{choices:true}
})
return questions;
}


}
