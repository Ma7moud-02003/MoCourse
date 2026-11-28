import { IsEnum, IsNotEmpty, IsString, MaxLength } from "class-validator";
import { PaymentMethoeEnum } from "src/utils/enums/paymentMethode.enum";

export class ConfirmCheckoutDto{
    @IsEnum(PaymentMethoeEnum)
    paymentMethod!:PaymentMethoeEnum;
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    transactionId!:string;
}
