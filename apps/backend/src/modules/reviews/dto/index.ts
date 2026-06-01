/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  MaxLength,
} from 'class-validator';

export enum ReviewRatingEnum {
  ONE = 'ONE',
  TWO = 'TWO',
  THREE = 'THREE',
  FOUR = 'FOUR',
  FIVE = 'FIVE',
}

export class CreateReviewDto {
  @IsUUID()
  bookingId: string;

  @IsUUID()
  spotId: string;

  @IsEnum(ReviewRatingEnum)
  rating: ReviewRatingEnum;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class ReviewResponseDto {
  id: string;
  bookingId: string;
  spotId: string;
  authorId: string;
  rating: ReviewRatingEnum;
  comment?: string;
  author: {
    id: string;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
