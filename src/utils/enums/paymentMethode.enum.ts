export enum PaymentMethoeEnum {
  INSYTAPAY = 'instapay',             // أنشأ طلب شراء ولم يدفع
  VODAFONCACH = 'vodafonCach', // دفع ومستني مراجعة
  ORANGECACH = 'orangeCash',                   // تم التأكيد
  BANKACCOUNT = 'bankAccount',               // مرفوض أو فشل الدفع
}