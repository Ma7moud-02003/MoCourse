import { IsEnum } from "class-validator";
import { StatusEnum } from "src/utils/enums/purchaseStatus.enum";

export class UpdatePurchaseStatusDto {
  @IsEnum(StatusEnum)
  status!: StatusEnum
}