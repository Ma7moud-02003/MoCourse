import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CategoryEntity } from './category.entity';
import { Repository } from 'typeorm';
import { CategoryDto } from './dtos/cat.dto';

@Injectable()
export class CategoryService {
    constructor(
        @InjectRepository(CategoryEntity)
        private catRepo:Repository<CategoryEntity>
    ){

    }

/**
 * 
 * @param dto 
 * @returns successfull message
 */
public async creatCat(dto:CategoryDto){
  const category=await this.catRepo.findOne({where:{name:dto.name}});
  if(category) throw new  ConflictException('Category is already existed');

 let cat=this.catRepo.create(dto);
 await this.catRepo.save(cat);
 return {
    message:'Cat Added Successfully',
    cat
 }}

 getAllCatogs():Promise<any>{
    return this.catRepo.find();
 }


}
