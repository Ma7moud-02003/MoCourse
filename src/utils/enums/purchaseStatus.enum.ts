export enum StatusEnum {
  PENDING = 'PENDING',             // أنشأ طلب شراء ولم يدفع
  WAITING_APPROVAL = 'WAITING_APPROVAL', // دفع ومستني مراجعة
  PAID = 'PAID',                   // تم التأكيد
  FAILED = 'FAILED',               // مرفوض أو فشل الدفع
}