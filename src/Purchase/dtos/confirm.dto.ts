import { IsNotEmpty } from "class-validator";
import { PaymentMethoeEnum } from "src/utils/enums/paymentMethode.enum";

export class ConfirmCheckoutDto{
    @IsNotEmpty()
    paymentMethod!:PaymentMethoeEnum;
    @IsNotEmpty()
    transactionId!:string;
}