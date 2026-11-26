import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QuizEntity } from './quiz.entity';
import { Repository } from 'typeorm';
import { CreateQuizDto } from './dtos/creat.dto';
import { CourseService } from 'src/course/course.service';
import { EnrollmentService } from 'src/enrollment/enrollment.service';
import { UpdateQuizDto } from './dtos/update.dto';
import { QuestionEntity } from 'src/question/question.entity';
import { checkWindow, parseInstant, windowMinutes } from './exam-window';
import { QuizAttemptEntity } from 'src/quiz-attempt/quiz-attemp.entity';


@Injectable()
export class QuizService {
  constructor(
    @InjectRepository(QuizEntity)
    private quizRepo: Repository<QuizEntity>,
     @InjectRepository(QuestionEntity)
    private questionRepo: Repository<QuestionEntity>,
    private courseService: CourseService,
    private enrollService: EnrollmentService

  ) { }

  /**
   * creat new quiz
   * @param insId 
   * @param dto 
   * @returns created quiz
   */
  public async creatNewQuiz(
    insId: number,
    dto: CreateQuizDto
  ) {
    if (!dto.title || !insId || !dto.courseId) {
      throw new BadRequestException(); }
    let quiz: QuizEntity;
    const opensAt = parseInstant(dto.opensAt, 'opensAt');
    const closesAt = parseInstant(dto.closesAt, 'closesAt');
    checkWindow(opensAt, closesAt);
    const quizData = {
      title: dto.title,
      description: dto.description,
      passMark: dto.passMark,
      timeLimit: dto.timeLimit ?? windowMinutes(opensAt, closesAt),
      opensAt,
      closesAt,
      maxAttempts: dto.maxAttempts,
      shuffleQuestions: dto.shuffleQuestions,
      shuffleChoices: dto.shuffleChoices,
      showResultImmediately: dto.showResultImmediately,
      isPublished: false,
      totalMarks: 0,
      quizTarget: dto.quizTarget,
      course:{ id:dto.courseId},
      section:{id:dto.sectionId},
      lesson:{id:dto.lessonId},

    };
  
        // existence check only: getCourseDetails throws NotFound when the course does not exist
        await this.courseService.getCourseDetails(dto.courseId);
        const ownsCourse = await this.courseService.verifyingInstractorOwnTheCourse(insId, dto.courseId);
        if (!ownsCourse) throw new ForbiddenException('You do not own this course');
        if (dto.isPublished) {throw new BadRequestException('A new exam starts as a draft. Add questions first, then publish it.');}
        if (dto.sectionId || dto.lessonId) {throw new BadRequestException('Course quiz cannot have sectionId or lessonId');}
        quiz = this.quizRepo.create({
          ...quizData
        });
       
    return await this.quizRepo.save(quiz);
  }

  public async updateQuiz(
  quizId: number,
  insId: number,
  dto: UpdateQuizDto,
) {
  if (!quizId || !insId) {
    throw new BadRequestException('Invalid quiz or instructor ID');
  }

  const isOwner = await this.verifyingInstractors(quizId, insId);

  if (!isOwner) {
    throw new ForbiddenException(
      'You are not allowed to update this quiz',
    );
  }

  // lock the quiz row so publish and question deletes run one at a time
  return this.quizRepo.manager.transaction(async (manager) => {
  const quiz = await manager.findOne(QuizEntity, {
    where: { id: quizId },
    lock: { mode: 'pessimistic_write' },
  });

  if (!quiz) {
    throw new NotFoundException('Quiz not found');
  }

  // once any student started, the exam and its settings are frozen
  const attempts = await manager.count(QuizAttemptEntity, { where: { quiz: { id: quizId } } });
  if (attempts > 0) {
    throw new ConflictException('Students already started this exam, so its settings can no longer change');
  }

  if (dto.title !== undefined) {
    quiz.title = dto.title;
  }

  if (dto.description !== undefined) {
    quiz.description = dto.description;
  }

  if (dto.passMark !== undefined) {
    quiz.passMark = dto.passMark;
  }

  if (dto.timeLimit !== undefined) {
    quiz.timeLimit = dto.timeLimit;
  }

  if (dto.opensAt !== undefined || dto.closesAt !== undefined) {
    const opensAt = dto.opensAt !== undefined ? parseInstant(dto.opensAt, 'opensAt') : quiz.opensAt;
    const closesAt = dto.closesAt !== undefined ? parseInstant(dto.closesAt, 'closesAt') : quiz.closesAt;
    if (!opensAt || !closesAt) throw new BadRequestException('Set both opensAt and closesAt');
    checkWindow(opensAt, closesAt);
    quiz.opensAt = opensAt;
    quiz.closesAt = closesAt;
  }

  if (dto.maxAttempts !== undefined) {
    quiz.maxAttempts = dto.maxAttempts;
  }

  if (dto.shuffleQuestions !== undefined) {
    quiz.shuffleQuestions = dto.shuffleQuestions;
  }

  if (dto.shuffleChoices !== undefined) {
    quiz.shuffleChoices = dto.shuffleChoices;
  }

  if (dto.showResultImmediately !== undefined) {
    quiz.showResultImmediately = dto.showResultImmediately;
  }

  if (dto.isPublished !== undefined) {
    if (dto.isPublished && !quiz.isPublished) {
      const questionsCount = await manager.count(QuestionEntity, { where: { quiz: { id: quizId } } });
      if (questionsCount === 0) {
        throw new BadRequestException('Add at least one question before publishing the exam');
      }
    }
    if (dto.isPublished && (!quiz.opensAt || !quiz.closesAt)) {
      throw new BadRequestException('Set the exam opening and closing time before publishing');
    }
    quiz.isPublished = dto.isPublished;
  }

  if (dto.instructions !== undefined) {
    quiz.instructions = dto.instructions;
  }
  return await manager.save(quiz);
  });
}
  /**
   * get quizes belngs to student
   * @param courseId 
   * @param studentId 
   * @returns  quizes
   */
  public async getQuizes(courseId: number, studentId: number) {
    if (!courseId || !studentId) throw new BadRequestException();
    const isEnrolled = await this.enrollService.verifyStudentEnrollment(studentId, courseId);
    if (!isEnrolled) throw new ForbiddenException('You Need to purchase  course frist ');
    const quizes = await this.quizRepo.find({
      where:{course:{id:courseId},isPublished:true},order:{createdAt:'desc'}
    })
    return quizes;
  }


async deleteQuize(quizId:number,insId:number){
    if (!quizId || !insId) throw new BadRequestException();
    const insVerifyed=await this.verifyingInstractors(quizId,insId);
    if(!insVerifyed) throw new ForbiddenException();
    // student results must never be wiped by a delete: refuse once any attempt exists.
    // The exclusive row lock makes this check and the delete atomic against a student starting.
    return this.quizRepo.manager.transaction(async (manager) => {
      const quiz = await manager.findOne(QuizEntity, { where: { id: quizId }, lock: { mode: 'pessimistic_write' } });
      if (!quiz) throw new NotFoundException('Quiz not found');
      const attempts = await manager.count(QuizAttemptEntity, { where: { quiz: { id: quizId } } });
      if (attempts > 0) throw new ConflictException('Students already started this exam, so it cannot be deleted');
      return await manager.delete(QuizEntity, quizId);
    });
  }

 /**
   * get quizes belngs to Instractor
   * @param insId 
   * @returns  quizes
   */
    public async getInsQuizes(insId: number) {
    if (!insId) throw new BadRequestException();

    const quizes = await this.quizRepo.find({
      where: {course:{Instractor:{id:insId}}},relations:{course:true},select:{course:{id:true,title:true,thumbnail:true}},order:{createdAt:'desc'}
    })
    return quizes;
  }


  
  public async getQuizDetails(quizId: number, insId: number, page: number = 1) {
  if (!insId || !quizId) throw new BadRequestException();
   const limit=10;
  // 1. التحقق من صلاحيات المدرس
  const insVerifyed = await this.verifyingInstractors(quizId, insId);
  if (!insVerifyed) throw new ForbiddenException();

  // 2. هنجيب بيانات الكويز الأساسية (من غير الأسئلة)
  const quiz = await this.quizRepo.findOne({
    where: { id: quizId },
  });

  if (!quiz) {
    throw new NotFoundException('Quiz not found');
  }

  // 3. هنجيب الأسئلة دفعة دفعة (Pagination) بالاعتماد على الـ Question Repository
  // تأكد إن عندك questionRepo حقون في الـ Constructor (حتى لو مش موجود ممكن نستخدمه)
  const [questions, total] = await this.questionRepo.findAndCount({
    where: { quiz: { id: quizId } }, // أو quizId: quizId حسب تصميم الداتابيز عندك
    relations: { choices: true },
    skip: (page - 1) * limit,
    take: limit,
  });

  // 4. نرجع النتيجة مرتبة ومعاها معلومات الـ Pagination
  return {
    ...quiz,
    questions,
    pagination: {
      totalItems: total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    },
  };
}



/**
 * verifying if instractor own this quiz and course
 * @param quizId 
 * @param insId 
 * @returns 
 */
  public async verifyingInstractors(quizId: number, insId: number): Promise<boolean> {
    const quiz = await this.quizRepo.findOne({
      where: { id: quizId },
      relations: { course: { Instractor: true } }
    })
    if(!quiz) throw new NotFoundException();
    return quiz?.course.Instractor.id === insId;
  }

}
