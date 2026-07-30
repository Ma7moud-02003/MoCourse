import {
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class PaymentInfoDto {
  @IsOptional()
  @IsString()
  @Length(5, 100)
  instapay?: string;

  @IsOptional()
  @Matches(/^01[0125][0-9]{8}$/, {
    message: 'Invalid Vodafone Cash number',
  })
  vodafoneCash?: string;

  @IsOptional()
  @Matches(/^01[0125][0-9]{8}$/, {
    message: 'Invalid Orange Cash number',
  })
  orangeCash?: string;

  @IsOptional()
  @IsString()
  @Length(10, 34)
  bankAccount?: string;

  @IsString()
  @Length(3, 100)
  ownerName!: string;
}