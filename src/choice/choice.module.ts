import { Module } from '@nestjs/common';
import { ChoiceController } from './choice.controller';
import { ChoiceService } from './choice.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChoiceEntity } from './choise.entity';


@Module({
  imports:[TypeOrmModule.forFeature([ChoiceEntity])],
  controllers: [ChoiceController],
  providers: [ChoiceService],
  exports:[ChoiceService]
})
export class ChoiceModule {}
